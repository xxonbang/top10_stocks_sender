"""
FastAPI 서버 - KIS API 실시간 호출 엔드포인트
Refresh 버튼 클릭 시 최신 주식 데이터를 실시간으로 수집하여 반환
"""
import os
import sys
import asyncio
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 프로젝트 루트를 sys.path에 추가 (모듈 import 위해)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from modules.kis_client import KISClient
from modules.kis_rank import KISRankAPI
from modules.stock_filter import StockFilter
from modules.stock_history import StockHistoryAPI
from modules.exchange_rate import ExchangeRateAPI
from modules.data_exporter import _strip_meta
from main import collect_all_stocks

KST = timezone(timedelta(hours=9))

app = FastAPI(title="Stock TOP10 API", version="1.0.0")

# CORS 설정
ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",")
ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS if o.strip()]
# 기본 허용 도메인
ALLOWED_ORIGINS += [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "https://xxonbang.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    """헬스체크 (keep-alive ping용)"""
    return {"status": "ok", "timestamp": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")}


def _refresh_sync():
    """실시간 데이터 수집 로직 (동기)"""
    errors = []

    # === Phase A: KIS Client 초기화 (순차 필수) ===
    try:
        client = KISClient()
        rank_api = KISRankAPI(client)
        history_api = StockHistoryAPI(client)
    except Exception as e:
        return {"error": f"KIS API 연결 실패: {e}", "errors": errors}

    # === Phase B: 환율(별도 스레드) + KIS 랭킹 4종(순차) 병렬 실행 ===
    # KIS API는 초당 호출 제한이 있어 랭킹 API끼리는 순차 실행 필수
    # 환율은 별도 서비스(한국수출입은행)이므로 KIS 호출과 병렬 가능
    exchange_data = {}
    volume_data = {}
    trading_value_data = {}
    fluctuation_data = {}
    fluctuation_direct_data = {}

    def fetch_exchange():
        return ExchangeRateAPI().get_exchange_rates()

    def fetch_kis_rankings():
        """KIS 랭킹 API 4종을 순차 실행하여 rate limit 회피"""
        results = {}
        # 거래량 (critical)
        results["volume"] = rank_api.get_top30_by_volume(exclude_etf=True)
        # 거래대금 (non-critical)
        try:
            results["trading_value"] = rank_api.get_top30_by_trading_value(exclude_etf=True)
        except Exception as e:
            results["trading_value_error"] = str(e)
        # 등락폭 (critical)
        results["fluctuation"] = rank_api.get_top30_by_fluctuation(exclude_etf=True)
        # 등락률 전용 API (non-critical)
        try:
            results["fluctuation_direct"] = rank_api.get_top_fluctuation_direct(exclude_etf=True)
        except Exception as e:
            results["fluctuation_direct_error"] = str(e)
        return results

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_exchange = executor.submit(fetch_exchange)
        future_kis = executor.submit(fetch_kis_rankings)

        # 환율 (non-critical)
        try:
            exchange_data = future_exchange.result()
        except Exception as e:
            errors.append(f"환율 조회 실패: {e}")

        # KIS 랭킹 4종
        try:
            kis_results = future_kis.result()
        except Exception as e:
            return {"error": f"KIS 랭킹 조회 실패: {e}", "errors": errors}

        # critical 결과 추출
        volume_data = kis_results.get("volume")
        if not volume_data:
            return {"error": "거래량 조회 실패", "errors": errors}

        fluctuation_data = kis_results.get("fluctuation")
        if not fluctuation_data:
            return {"error": "등락폭 조회 실패", "errors": errors}

        # non-critical 결과 추출
        if "trading_value_error" in kis_results:
            errors.append(f"거래대금 조회 실패: {kis_results['trading_value_error']}")
        else:
            trading_value_data = kis_results.get("trading_value", {})

        if "fluctuation_direct_error" in kis_results:
            errors.append(f"등락률 전용 API 실패: {kis_results['fluctuation_direct_error']}")
        else:
            fluctuation_direct_data = kis_results.get("fluctuation_direct", {})

    # === Phase C: 교차 필터링 + all_stocks 수집 (in-memory, 순차) ===
    stock_filter = StockFilter()
    rising_stocks = stock_filter.filter_rising_stocks(volume_data, fluctuation_data)
    falling_stocks = stock_filter.filter_falling_stocks(volume_data, fluctuation_data)

    all_stocks = collect_all_stocks(
        rising_stocks, falling_stocks,
        volume_data=volume_data,
        trading_value_data=trading_value_data,
        fluctuation_data=fluctuation_data,
        fluctuation_direct_data=fluctuation_direct_data,
    )

    # === Phase D: 히스토리 + 투자자 데이터 병렬 실행 ===
    history_data = {}
    investor_data = {}
    investor_estimated = False

    def fetch_history():
        return history_api.get_multiple_stocks_history(all_stocks, days=3)

    def fetch_investor():
        return rank_api.get_investor_data_auto(all_stocks)

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_history = executor.submit(fetch_history)
        future_investor = executor.submit(fetch_investor)

        try:
            history_data = future_history.result()
        except Exception as e:
            errors.append(f"등락률 조회 실패: {e}")

        try:
            investor_data, investor_estimated = future_investor.result()
        except Exception as e:
            errors.append(f"수급 데이터 수집 실패: {e}")

    # === Phase E: 응답 조립 ===
    data = {
        "timestamp": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
        "exchange": exchange_data or {},
        "rising": {
            "kospi": rising_stocks.get("kospi", []),
            "kosdaq": rising_stocks.get("kosdaq", []),
        },
        "falling": {
            "kospi": falling_stocks.get("kospi", []),
            "kosdaq": falling_stocks.get("kosdaq", []),
        },
        "volume": _strip_meta(volume_data) if volume_data else None,
        "trading_value": _strip_meta(trading_value_data) if trading_value_data else None,
        "fluctuation": _strip_meta(fluctuation_data) if fluctuation_data else None,
        "fluctuation_direct": _strip_meta(fluctuation_direct_data) if fluctuation_direct_data else None,
        "history": history_data,
        "news": {},
        "investor_data": investor_data if investor_data else None,
        "investor_estimated": investor_estimated if investor_data else None,
    }

    # None 값 필드 제거
    data = {k: v for k, v in data.items() if v is not None}

    if errors:
        data["_warnings"] = errors

    return data


@app.get("/api/refresh")
async def refresh():
    """실시간 데이터 수집 - 90초 전역 타임아웃 적용"""
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_refresh_sync),
            timeout=90,
        )
    except asyncio.TimeoutError:
        return {"error": "데이터 수집 시간이 초과되었습니다 (90초). 서버에서 KIS API에 연결할 수 없을 수 있습니다."}
