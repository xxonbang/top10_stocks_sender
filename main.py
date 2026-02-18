"""
KIS 거래량+등락폭 TOP10 텔레그램 발송
- 3일간 등락률 포함
- 종목별 실시간 뉴스 포함
"""
import argparse
from datetime import datetime
from typing import Dict, List, Any

from modules.kis_client import KISClient
from modules.kis_rank import KISRankAPI
from modules.stock_filter import StockFilter
from modules.stock_history import StockHistoryAPI
from modules.naver_news import NaverNewsAPI
from modules.telegram import TelegramSender
from modules.data_exporter import export_for_frontend
from modules.exchange_rate import ExchangeRateAPI
from modules.gemini_analyzer import analyze_themes
from modules.fundamental import FundamentalCollector
from modules.stock_criteria import evaluate_all_stocks


def collect_all_stocks(
    rising_stocks: Dict,
    falling_stocks: Dict,
    volume_data: Dict = None,
    trading_value_data: Dict = None,
    fluctuation_data: Dict = None,
    fluctuation_direct_data: Dict = None,
) -> List[Dict[str, Any]]:
    """상승/하락 종목 + 추가 데이터 소스에서 중복 제거된 전체 종목 리스트 추출"""
    seen_codes = set()
    all_stocks = []

    stock_lists = [
        rising_stocks.get("kospi", []),
        rising_stocks.get("kosdaq", []),
        falling_stocks.get("kospi", []),
        falling_stocks.get("kosdaq", []),
    ]

    # 추가 데이터 소스
    if volume_data:
        stock_lists.extend([volume_data.get("kospi", []), volume_data.get("kosdaq", [])])
    if trading_value_data:
        stock_lists.extend([trading_value_data.get("kospi", []), trading_value_data.get("kosdaq", [])])
    if fluctuation_data:
        stock_lists.extend([
            fluctuation_data.get("kospi_up", []), fluctuation_data.get("kospi_down", []),
            fluctuation_data.get("kosdaq_up", []), fluctuation_data.get("kosdaq_down", []),
        ])
    if fluctuation_direct_data:
        stock_lists.extend([
            fluctuation_direct_data.get("kospi_up", []), fluctuation_direct_data.get("kospi_down", []),
            fluctuation_direct_data.get("kosdaq_up", []), fluctuation_direct_data.get("kosdaq_down", []),
        ])

    for stocks in stock_lists:
        for stock in stocks:
            code = stock.get("code", "")
            if code and code not in seen_codes:
                seen_codes.add(code)
                all_stocks.append(stock)

    return all_stocks


def _get_gemini_target_stocks(stock_context: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Gemini 프롬프트에 포함되는 주요 종목만 추출 (중복 제거)

    거래대금+상승률 교차 종목, 상승률 TOP, 등락률 TOP 등에서 추출.
    """
    seen_codes = set()
    targets = []

    # 거래대금 TOP (코스피/코스닥)
    for market in ("kospi", "kosdaq"):
        for s in stock_context.get("trading_value", {}).get(market, [])[:20]:
            code = s.get("code", "")
            if code and code not in seen_codes:
                seen_codes.add(code)
                targets.append(s)

    # 상승률 TOP
    for market in ("kospi", "kosdaq"):
        for s in stock_context.get("rising", {}).get(market, [])[:10]:
            code = s.get("code", "")
            if code and code not in seen_codes:
                seen_codes.add(code)
                targets.append(s)

    # 등락률 상승 TOP
    for key in ("kospi_up", "kosdaq_up"):
        for s in stock_context.get("fluctuation", {}).get(key, [])[:20]:
            code = s.get("code", "")
            if code and code not in seen_codes:
                seen_codes.add(code)
                targets.append(s)

    # 거래량 TOP
    for market in ("kospi", "kosdaq"):
        for s in stock_context.get("volume", {}).get(market, [])[:20]:
            code = s.get("code", "")
            if code and code not in seen_codes:
                seen_codes.add(code)
                targets.append(s)

    return targets


def main(test_mode: bool = False, skip_news: bool = False, skip_investor: bool = False, skip_ai: bool = False):
    """메인 실행 함수

    Args:
        test_mode: 테스트 모드 (메시지 미발송, 콘솔 출력만)
        skip_news: 뉴스 수집 건너뛰기
        skip_investor: 수급 데이터 수집 건너뛰기
        skip_ai: AI 테마 분석 건너뛰기
    """
    print("=" * 60)
    print("  KIS 거래량+등락폭 TOP10 텔레그램 발송")
    print(f"  실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if test_mode:
        print("  [테스트 모드] 텔레그램 발송 없이 콘솔 출력만 수행")
    print("=" * 60)

    # 1. 환율 정보 조회
    print("\n[1/13] 환율 정보 조회 중...")
    exchange_data = {}
    try:
        exchange_api = ExchangeRateAPI()
        exchange_data = exchange_api.get_exchange_rates()
        if exchange_data.get("rates"):
            print(f"  ✓ 환율 조회 완료 (기준일: {exchange_data.get('search_date', '')})")
            for rate in exchange_data["rates"]:
                unit = "(100)" if rate["is_100"] else ""
                print(f"    {rate['currency']}{unit}: {rate['rate']:,.2f}원")
        else:
            print("  ⚠ 환율 데이터 없음 (영업일 아닐 수 있음)")
    except Exception as e:
        print(f"  ✗ 환율 조회 실패: {e}")

    # 2. KIS API 연결
    print("\n[2/13] KIS API 연결 중...")
    try:
        client = KISClient()
        rank_api = KISRankAPI(client)
        history_api = StockHistoryAPI(client)
        print("  ✓ KIS API 연결 성공")
    except Exception as e:
        print(f"  ✗ KIS API 연결 실패: {e}")
        return

    # 3. 거래량 TOP30 조회
    print("\n[3/13] 거래량 TOP30 조회 중...")
    try:
        volume_data = rank_api.get_top30_by_volume(exclude_etf=True)
        print(f"  ✓ 코스피: {len(volume_data.get('kospi', []))}개")
        print(f"  ✓ 코스닥: {len(volume_data.get('kosdaq', []))}개")
    except Exception as e:
        print(f"  ✗ 거래량 조회 실패: {e}")
        return

    # 4. 거래대금 TOP30 조회
    print("\n[4/13] 거래대금 TOP30 조회 중...")
    trading_value_data = {}
    try:
        trading_value_data = rank_api.get_top30_by_trading_value(exclude_etf=True)
        print(f"  ✓ 코스피: {len(trading_value_data.get('kospi', []))}개")
        print(f"  ✓ 코스닥: {len(trading_value_data.get('kosdaq', []))}개")
    except Exception as e:
        print(f"  ⚠ 거래대금 조회 실패 (빈 데이터로 계속): {e}")

    # 5. 등락폭 TOP30 조회 (자체 계산)
    print("\n[5/13] 등락폭 TOP30 조회 중...")
    try:
        fluctuation_data = rank_api.get_top30_by_fluctuation(exclude_etf=True)
        print(f"  ✓ 코스피 상승: {len(fluctuation_data.get('kospi_up', []))}개")
        print(f"  ✓ 코스피 하락: {len(fluctuation_data.get('kospi_down', []))}개")
        print(f"  ✓ 코스닥 상승: {len(fluctuation_data.get('kosdaq_up', []))}개")
        print(f"  ✓ 코스닥 하락: {len(fluctuation_data.get('kosdaq_down', []))}개")
    except Exception as e:
        print(f"  ✗ 등락폭 조회 실패: {e}")
        return

    # 6. 등락률 전용 API 조회
    print("\n[6/13] 등락률 전용 API 조회 중...")
    fluctuation_direct_data = {}
    try:
        fluctuation_direct_data = rank_api.get_top_fluctuation_direct(exclude_etf=True)
        print(f"  ✓ 코스피 상승: {len(fluctuation_direct_data.get('kospi_up', []))}개")
        print(f"  ✓ 코스피 하락: {len(fluctuation_direct_data.get('kospi_down', []))}개")
        print(f"  ✓ 코스닥 상승: {len(fluctuation_direct_data.get('kosdaq_up', []))}개")
        print(f"  ✓ 코스닥 하락: {len(fluctuation_direct_data.get('kosdaq_down', []))}개")
    except Exception as e:
        print(f"  ⚠ 등락률 전용 API 조회 실패 (빈 데이터로 계속): {e}")

    # 7. 교차 필터링
    print("\n[7/13] 교차 필터링 중...")
    stock_filter = StockFilter()

    rising_stocks = stock_filter.filter_rising_stocks(volume_data, fluctuation_data)
    falling_stocks = stock_filter.filter_falling_stocks(volume_data, fluctuation_data)

    # 거래대금+등락률 교차 필터링
    tv_rising_stocks = stock_filter.filter_rising_stocks_by_trading_value(trading_value_data, fluctuation_data)
    tv_falling_stocks = stock_filter.filter_falling_stocks_by_trading_value(trading_value_data, fluctuation_data)

    print(f"  ✓ 거래대금+상승 (코스피: {len(tv_rising_stocks['kospi'])}개, 코스닥: {len(tv_rising_stocks['kosdaq'])}개)")
    print(f"  ✓ 거래대금+하락 (코스피: {len(tv_falling_stocks['kospi'])}개, 코스닥: {len(tv_falling_stocks['kosdaq'])}개)")
    print(f"  ✓ 거래량+상승 (코스피: {len(rising_stocks['kospi'])}개, 코스닥: {len(rising_stocks['kosdaq'])}개)")
    print(f"  ✓ 거래량+하락 (코스피: {len(falling_stocks['kospi'])}개, 코스닥: {len(falling_stocks['kosdaq'])}개)")

    # 전체 종목 리스트 (중복 제거)
    all_stocks = collect_all_stocks(
        rising_stocks, falling_stocks,
        volume_data=volume_data,
        trading_value_data=trading_value_data,
        fluctuation_data=fluctuation_data,
        fluctuation_direct_data=fluctuation_direct_data,
    )
    print(f"  ✓ 총 {len(all_stocks)}개 종목")

    # 8. 3일간 등락률 조회
    print("\n[8/13] 3일간 등락률 조회 중...")
    try:
        history_data = history_api.get_multiple_stocks_history(all_stocks, days=3)
        print(f"  ✓ {len(history_data)}개 종목 등락률 조회 완료")
    except Exception as e:
        print(f"  ✗ 등락률 조회 실패: {e}")
        history_data = {}

    # 8-1. 펀더멘탈 데이터 수집
    fundamental_data = {}
    if not skip_ai:
        print("\n[8-1/13] 펀더멘탈 데이터 수집 중...")
        try:
            fundamental_collector = FundamentalCollector(client)

            # Gemini에 전달할 주요 종목만 추출
            stock_context_for_targets = {
                "rising": rising_stocks,
                "volume": volume_data,
                "trading_value": trading_value_data,
                "fluctuation": fluctuation_data,
            }
            target_stocks = _get_gemini_target_stocks(stock_context_for_targets)

            # RSI 계산용 raw 일봉 데이터
            daily_raw = {code: h.get("raw_daily_prices", []) for code, h in history_data.items()}

            fundamental_data = fundamental_collector.collect_all_fundamentals(target_stocks, daily_raw)
            print(f"  \u2713 {len(fundamental_data)}개 종목 펀더멘탈 수집 완료")
        except Exception as e:
            print(f"  \u26a0 펀더멘탈 수집 실패 (빈 데이터로 계속): {e}")
    else:
        print("\n[8-1/13] 펀더멘탈 데이터 수집 건너뜀 (--skip-ai)")

    # 9. 수급(투자자) 데이터 수집
    investor_data = {}
    investor_estimated = False
    if not skip_investor:
        print("\n[9/13] 수급(투자자) 데이터 수집 중...")
        try:
            investor_data, investor_estimated = rank_api.get_investor_data_auto(all_stocks)
            label = "추정" if investor_estimated else "확정"
            print(f"  ✓ {len(investor_data)}개 종목 수급 데이터 수집 완료 ({label})")
        except Exception as e:
            print(f"  ⚠ 수급 데이터 수집 실패 (빈 데이터로 계속): {e}")
            investor_data = {}
    else:
        print("\n[9/13] 수급 데이터 수집 건너뜀")

    # 10. AI 테마 분석
    theme_analysis = None
    if not skip_ai:
        print("\n[10/13] AI 테마 분석 중...")
        try:
            stock_context = {
                "rising": rising_stocks,
                "falling": falling_stocks,
                "volume": volume_data,
                "trading_value": trading_value_data,
                "fluctuation": fluctuation_data,
            }
            theme_analysis = analyze_themes(
                stock_context,
                fundamental_data=fundamental_data,
                investor_data=investor_data,
            )
            if theme_analysis:
                theme_count = len(theme_analysis.get("themes", []))
                print(f"  ✓ AI 테마 분석 완료 ({theme_count}개 테마 도출)")
            else:
                print("  ⚠ AI 테마 분석 실패 (건너뜀)")
        except Exception as e:
            print(f"  ⚠ AI 테마 분석 실패 (건너뜀): {e}")
    else:
        print("\n[10/13] AI 테마 분석 건너뜀")

    # 10-1. 종목 선정 기준 평가
    criteria_data = {}
    print("\n[10-1/13] 종목 선정 기준 평가 중...")
    try:
        criteria_data = evaluate_all_stocks(
            all_stocks=all_stocks,
            history_data=history_data,
            fundamental_data=fundamental_data,
            investor_data=investor_data,
            trading_value_data=trading_value_data,
        )
        met_all = sum(1 for v in criteria_data.values() if v.get("all_met"))
        print(f"  ✓ {len(criteria_data)}개 종목 평가 완료 (전 기준 충족: {met_all}개)")
    except Exception as e:
        print(f"  ⚠ 기준 평가 실패 (빈 데이터로 계속): {e}")

    # 11. 뉴스 수집
    news_data = {}
    if not skip_news:
        print("\n[11/13] 종목별 뉴스 수집 중...")
        try:
            news_api = NaverNewsAPI()
            news_data = news_api.get_multiple_stocks_news(all_stocks, news_count=3)
            news_count = sum(1 for v in news_data.values() if v.get("news"))
            print(f"  ✓ {news_count}개 종목 뉴스 수집 완료")
        except Exception as e:
            print(f"  ✗ 뉴스 수집 실패: {e}")
            news_data = {}
    else:
        print("\n[11/13] 뉴스 수집 건너뜀")

    # 12. 프론트엔드용 데이터 내보내기
    print("\n[12/13] 프론트엔드 데이터 내보내기...")
    try:
        export_path = export_for_frontend(
            rising_stocks, falling_stocks, history_data, news_data, exchange_data,
            volume_data=volume_data,
            trading_value_data=trading_value_data,
            fluctuation_data=fluctuation_data,
            fluctuation_direct_data=fluctuation_direct_data,
            investor_data=investor_data,
            investor_estimated=investor_estimated,
            criteria_data=criteria_data,
            theme_analysis=theme_analysis,
        )
        print(f"  ✓ 데이터 내보내기 완료: {export_path}")
    except Exception as e:
        print(f"  ✗ 데이터 내보내기 실패: {e}")

    # 11. 텔레그램 발송
    print("\n[13/13] 텔레그램 메시지 준비...")
    telegram = TelegramSender()

    # 바리케이트 메시지 (환율 정보 포함)
    start_barricade = telegram.format_start_barricade(exchange_data)
    end_barricade = telegram.format_end_barricade()

    # 거래대금+상승률 메시지
    tv_rising_message = telegram.format_rising_stocks(
        tv_rising_stocks["kospi"],
        tv_rising_stocks["kosdaq"],
        history_data,
        title="📈 거래대금 + 상승률 TOP10",
    )

    # 거래대금+하락률 메시지
    tv_falling_message = telegram.format_falling_stocks(
        tv_falling_stocks["kospi"],
        tv_falling_stocks["kosdaq"],
        history_data,
        title="📉 거래대금 + 하락률 TOP10",
    )

    # 거래량+상승률 메시지
    rising_message = telegram.format_rising_stocks(
        rising_stocks["kospi"],
        rising_stocks["kosdaq"],
        history_data,
    )

    # 거래량+하락률 메시지
    falling_message = telegram.format_falling_stocks(
        falling_stocks["kospi"],
        falling_stocks["kosdaq"],
        history_data,
    )

    # AI 테마 분석 메시지
    theme_messages = []
    if theme_analysis:
        theme_messages = telegram.format_theme_analysis(theme_analysis)

    def _clean_html(text: str) -> str:
        """HTML 태그 제거 (콘솔 출력용)"""
        text = text.replace("<b>", "").replace("</b>", "")
        text = text.replace('<a href="', "[").replace('">', "] ").replace("</a>", "")
        text = text.replace("<i>", "").replace("</i>", "")
        text = text.replace("<code>", "").replace("</code>", "")
        return text

    if test_mode:
        print("\n" + "=" * 60)
        print("🚀 START 바리케이트:")
        print("=" * 60)
        print(start_barricade)

        print("\n" + "=" * 60)
        print("📈 거래대금+상승률 메시지:")
        print("=" * 60)
        print(_clean_html(tv_rising_message))

        print("\n" + "=" * 60)
        print("📉 거래대금+하락률 메시지:")
        print("=" * 60)
        print(_clean_html(tv_falling_message))

        print("\n" + "=" * 60)
        print("📈 거래량+상승률 메시지:")
        print("=" * 60)
        print(_clean_html(rising_message))

        print("\n" + "=" * 60)
        print("📉 거래량+하락률 메시지:")
        print("=" * 60)
        print(_clean_html(falling_message))

        if theme_messages:
            for i, msg in enumerate(theme_messages, 1):
                print("\n" + "=" * 60)
                print(f"✨ AI 테마 분석 ({i}/{len(theme_messages)}):")
                print("=" * 60)
                print(_clean_html(msg))

        print("\n" + "=" * 60)
        print("🏁 END 바리케이트:")
        print("=" * 60)
        print(end_barricade)
    else:
        # 1. START 바리케이트
        print("  START 바리케이트 발송 중...")
        if telegram.send_message(start_barricade):
            print("  ✓ START 바리케이트 발송 완료")
        else:
            print("  ✗ START 바리케이트 발송 실패")

        # 2. 거래대금+상승률 메시지
        print("  거래대금+상승률 메시지 발송 중...")
        if telegram.send_message(tv_rising_message):
            print("  ✓ 거래대금+상승률 메시지 발송 완료")
        else:
            print("  ✗ 거래대금+상승률 메시지 발송 실패")

        # 3. 거래대금+하락률 메시지
        print("  거래대금+하락률 메시지 발송 중...")
        if telegram.send_message(tv_falling_message):
            print("  ✓ 거래대금+하락률 메시지 발송 완료")
        else:
            print("  ✗ 거래대금+하락률 메시지 발송 실패")

        # 4. 거래량+상승률 메시지
        print("  거래량+상승률 메시지 발송 중...")
        if telegram.send_message(rising_message):
            print("  ✓ 거래량+상승률 메시지 발송 완료")
        else:
            print("  ✗ 거래량+상승률 메시지 발송 실패")

        # 5. 거래량+하락률 메시지
        print("  거래량+하락률 메시지 발송 중...")
        if telegram.send_message(falling_message):
            print("  ✓ 거래량+하락률 메시지 발송 완료")
        else:
            print("  ✗ 거래량+하락률 메시지 발송 실패")

        # 6. AI 테마 분석 메시지
        if theme_messages:
            print(f"  AI 테마 분석 발송 중... ({len(theme_messages)}개)")
            for i, msg in enumerate(theme_messages, 1):
                if telegram.send_message(msg):
                    print(f"  ✓ AI 테마 분석 {i}/{len(theme_messages)} 발송 완료")
                else:
                    print(f"  ✗ AI 테마 분석 {i}/{len(theme_messages)} 발송 실패")

        # 7. END 바리케이트
        print("  END 바리케이트 발송 중...")
        if telegram.send_message(end_barricade):
            print("  ✓ END 바리케이트 발송 완료")
        else:
            print("  ✗ END 바리케이트 발송 실패")

    print("\n" + "=" * 60)
    print("  완료!")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KIS 거래량+등락폭 TOP10 텔레그램 발송")
    parser.add_argument(
        "--test",
        action="store_true",
        help="테스트 모드 (텔레그램 발송 없이 콘솔 출력만)",
    )
    parser.add_argument(
        "--skip-news",
        action="store_true",
        help="뉴스 수집 건너뛰기",
    )
    parser.add_argument(
        "--skip-investor",
        action="store_true",
        help="수급 데이터 수집 건너뛰기",
    )
    parser.add_argument(
        "--skip-ai",
        action="store_true",
        help="AI 테마 분석 건너뛰기",
    )
    args = parser.parse_args()

    main(test_mode=args.test, skip_news=args.skip_news, skip_investor=args.skip_investor, skip_ai=args.skip_ai)
