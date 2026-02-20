"""
KIS 거래량+등락폭 TOP10 텔레그램 발송
- 3일간 등락률 포함
- 종목별 실시간 뉴스 포함
"""
import argparse
import json
import os
import time
from datetime import datetime, timedelta
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

    # 2-1. 코스닥 지수 이동평균선 분석 (API 페이지당 50건 제한 → 여러 페이지 조회)
    kosdaq_index_data = None
    print("\n[2-1/13] 코스닥 지수 이동평균선 분석 중...")
    for attempt in range(3):
        try:
            if attempt > 0:
                time.sleep(3 * attempt)
                print(f"  재시도 ({attempt + 1}/3)...")

            all_items = []
            end_date = datetime.now().strftime("%Y%m%d")
            for page in range(3):  # 최대 3페이지 (150건)
                start_date = (datetime.now() - timedelta(days=300)).strftime("%Y%m%d")
                idx_resp = client.get_index_daily_price(
                    "2001", start_date=start_date, end_date=end_date
                )
                rt_cd = idx_resp.get("rt_cd")
                if rt_cd != "0":
                    msg = idx_resp.get("msg1", "알 수 없음")
                    print(f"  ⚠ 코스닥 지수 API 응답 오류 (rt_cd={rt_cd}, msg={msg})")
                    break
                page_items = idx_resp.get("output2", [])
                if not page_items:
                    break
                all_items.extend(page_items)
                if len(all_items) >= 120:
                    break
                # 다음 페이지: 마지막 날짜 하루 전부터
                last_date = page_items[-1].get("stck_bsop_date", "")
                if not last_date:
                    break
                end_date = (datetime.strptime(last_date, "%Y%m%d") - timedelta(days=1)).strftime("%Y%m%d")

            closes = []
            for item in all_items:
                try:
                    val = float(item.get("bstp_nmix_prpr", 0))
                    if val > 0:
                        closes.append(val)
                except (ValueError, TypeError):
                    continue

            if len(closes) >= 60:
                current = closes[0]
                ma5 = sum(closes[:5]) / 5
                ma10 = sum(closes[:10]) / 10
                ma20 = sum(closes[:20]) / 20
                ma60 = sum(closes[:60]) / 60
                ma120 = sum(closes[:120]) / 120 if len(closes) >= 120 else 0

                values = [current, ma5, ma10, ma20, ma60]
                if ma120 > 0:
                    values.append(ma120)
                is_aligned = all(values[i] > values[i+1] for i in range(len(values)-1))
                is_reversed = all(values[i] < values[i+1] for i in range(len(values)-1))

                status = "정배열" if is_aligned else ("역배열" if is_reversed else "혼합")
                kosdaq_index_data = {
                    "current": round(current, 2),
                    "ma5": round(ma5, 2),
                    "ma10": round(ma10, 2),
                    "ma20": round(ma20, 2),
                    "ma60": round(ma60, 2),
                    "ma120": round(ma120, 2) if ma120 > 0 else 0,
                    "status": status,
                }
                print(f"  ✓ 코스닥 지수: {current:.2f} ({status}) [{len(closes)}일분 데이터]")
                break
            else:
                print(f"  ⚠ 코스닥 지수 데이터 부족 ({len(closes)}일분, 전체 {len(all_items)}건)")
                break  # 데이터 부족은 재시도해도 동일
        except Exception as e:
            print(f"  ⚠ 코스닥 지수 분석 실패: {e}")
            if attempt == 2:
                break

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

    # 8-1. 펀더멘탈 데이터 수집 (criteria 평가에 필요하므로 항상 실행)
    fundamental_data = {}
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

    # 8-2. 공매도 비중 수집 (펀더멘탈 수집 대상 종목만)
    short_selling_data = {}
    short_target_codes = set(fundamental_data.keys()) if fundamental_data else set()
    if short_target_codes:
        print(f"\n[8-2/13] 공매도 비중 수집 중... ({len(short_target_codes)}개 종목)")
        try:
            today = datetime.now().strftime("%Y%m%d")
            target_list = [s for s in all_stocks if s.get("code", "") in short_target_codes]
            for idx, stock in enumerate(target_list):
                code = stock.get("code", "")
                try:
                    resp = client.get_daily_short_sale(code, today, today)
                    if resp.get("rt_cd") == "0":
                        output2 = resp.get("output2", [])
                        if output2:
                            ratio_str = output2[0].get("ssts_vol_rlim", "0")
                            volume_str = output2[0].get("ssts_cntg_qty", "0")
                            try:
                                ratio = float(ratio_str)
                                volume = int(volume_str)
                                if ratio > 0:
                                    short_selling_data[code] = {
                                        "ratio": ratio,
                                        "volume": volume,
                                    }
                            except (ValueError, TypeError):
                                pass
                except Exception:
                    pass
                if (idx + 1) % 50 == 0 or idx + 1 == len(target_list):
                    print(f"  진행: {idx + 1}/{len(target_list)}")
            print(f"  ✓ {len(short_selling_data)}개 종목 공매도 데이터 수집 완료")
        except Exception as e:
            print(f"  ⚠ 공매도 수집 실패: {e}")
    else:
        print("\n[8-2/13] 공매도 비중 수집 건너뜀 (펀더멘탈 대상 없음)")

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
    if skip_ai:
        # 기존 데이터에서 theme_analysis 보존
        try:
            existing_path = os.path.join("frontend", "public", "data", "latest.json")
            if os.path.exists(existing_path):
                with open(existing_path, "r", encoding="utf-8") as f:
                    existing = json.load(f)
                theme_analysis = existing.get("theme_analysis")
                if theme_analysis:
                    print("\n[10/13] AI 테마 분석 건너뜀 (기존 분석 결과 보존)")
                else:
                    print("\n[10/13] AI 테마 분석 건너뜀 (보존할 기존 결과 없음)")
        except Exception:
            print("\n[10/13] AI 테마 분석 건너뜀")
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
            short_selling_data=short_selling_data,
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

    # 11-1. 수집 실패 데이터 기존 값 폴백
    _existing_data = None
    if not exchange_data.get("rates") or kosdaq_index_data is None or theme_analysis is None:
        try:
            existing_path = os.path.join("frontend", "public", "data", "latest.json")
            if os.path.exists(existing_path):
                with open(existing_path, "r", encoding="utf-8") as f:
                    _existing_data = json.load(f)
        except Exception:
            pass

    if _existing_data:
        if not exchange_data.get("rates") and _existing_data.get("exchange", {}).get("rates"):
            exchange_data = _existing_data["exchange"]
            print(f"  ℹ 환율: 기존 데이터 보존 (기준일: {exchange_data.get('search_date', '')})")

        if kosdaq_index_data is None and _existing_data.get("kosdaq_index"):
            kosdaq_index_data = _existing_data["kosdaq_index"]
            print(f"  ℹ 코스닥 지수: 기존 데이터 보존 ({kosdaq_index_data.get('status', '')})")

        if theme_analysis is None and _existing_data.get("theme_analysis"):
            theme_analysis = _existing_data["theme_analysis"]
            theme_count = len(theme_analysis.get("themes", []))
            print(f"  ℹ 테마 분석: 기존 데이터 보존 ({theme_count}개 테마)")

    # 히스토리에서 테마 분석 폴백 (latest.json에도 없는 경우)
    if theme_analysis is None:
        try:
            hist_dir = os.path.join("frontend", "public", "data", "history")
            if os.path.isdir(hist_dir):
                for fname in sorted(os.listdir(hist_dir), reverse=True)[:10]:
                    fpath = os.path.join(hist_dir, fname)
                    with open(fpath, "r", encoding="utf-8") as f:
                        hist = json.load(f)
                    if hist.get("theme_analysis"):
                        theme_analysis = hist["theme_analysis"]
                        theme_count = len(theme_analysis.get("themes", []))
                        print(f"  ℹ 테마 분석: 히스토리에서 복원 ({fname}, {theme_count}개 테마)")
                        break
        except Exception:
            pass

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
            kosdaq_index=kosdaq_index_data,
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
