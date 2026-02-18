"""종목별 펀더멘탈(재무/밸류에이션) 데이터 수집 모듈"""

from typing import Dict, List, Any, Optional

from modules.kis_client import KISClient


def safe_float(value) -> Optional[float]:
    """문자열/숫자를 float로 안전하게 변환"""
    if value is None or value == "":
        return None
    try:
        v = float(value)
        return v if v != 0 else None
    except (ValueError, TypeError):
        return None


class FundamentalCollector:
    """종목별 펀더멘탈 데이터 수집기"""

    def __init__(self, client: KISClient):
        self.client = client

    def calculate_rsi(self, daily_prices: List[Dict], period: int = 14) -> Optional[float]:
        """일봉 종가 데이터에서 RSI(14) 계산 (Wilder's Smoothed RSI)

        Args:
            daily_prices: get_stock_daily_price()의 output2 (최신순 정렬)
            period: RSI 기간 (기본 14일)

        Returns:
            RSI 값 (0~100) 또는 데이터 부족 시 None
        """
        if not daily_prices or len(daily_prices) < period + 1:
            return None

        # 최신순 → 오래된 순으로 뒤집기
        prices = list(reversed(daily_prices))

        closes = []
        for p in prices:
            try:
                closes.append(int(p.get("stck_clpr", 0)))
            except (ValueError, TypeError):
                continue

        if len(closes) < period + 1:
            return None

        # 일별 변동폭 계산
        gains = []
        losses = []
        for i in range(1, len(closes)):
            diff = closes[i] - closes[i - 1]
            gains.append(max(diff, 0))
            losses.append(max(-diff, 0))

        if len(gains) < period:
            return None

        # 초기 평균 (단순 평균)
        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period

        # Wilder's smoothing
        for i in range(period, len(gains)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return round(rsi, 2)

    def collect_fundamental(self, stock_code: str) -> Dict[str, Any]:
        """단일 종목 펀더멘탈 데이터 수집

        2개 API 호출:
        1. get_stock_price() -> PER, PBR, EPS, BPS, 시가총액
        2. get_financial_ratio() -> ROE, 부채비율, 영업이익률(OPM), 매출액증가율
        + PEG = PER / 매출액증가율 (계산)
        """
        result = {
            "per": None, "pbr": None, "eps": None, "bps": None,
            "market_cap": None,
            "roe": None, "debt_ratio": None, "eps_growth": None,
            "opm": None,
            "peg": None, "rsi": None,
            "pgtr_ntby_qty": None,
            "w52_hgpr": None,
            "w52_lwpr": None,
            "stck_prpr": None,
        }

        # 1) inquire-price -> per, pbr, eps, bps, hts_avls(시가총액)
        try:
            price_data = self.client.get_stock_price(stock_code)
            if price_data.get("rt_cd") == "0":
                output = price_data.get("output", {})
                result["per"] = safe_float(output.get("per"))
                result["pbr"] = safe_float(output.get("pbr"))
                result["eps"] = safe_float(output.get("eps"))
                result["bps"] = safe_float(output.get("bps"))
                result["market_cap"] = safe_float(output.get("hts_avls"))
                # 52주 최고가/최저가, 현재가
                w52h = output.get("w52_hgpr")
                if w52h is not None and w52h != "":
                    try:
                        result["w52_hgpr"] = int(w52h)
                    except (ValueError, TypeError):
                        pass
                w52l = output.get("w52_lwpr")
                if w52l is not None and w52l != "":
                    try:
                        result["w52_lwpr"] = int(w52l)
                    except (ValueError, TypeError):
                        pass
                prpr = output.get("stck_prpr")
                if prpr is not None and prpr != "":
                    try:
                        result["stck_prpr"] = int(prpr)
                    except (ValueError, TypeError):
                        pass
                # 프로그램 매매 순매수 수량
                pgtr = output.get("pgtr_ntby_qty")
                if pgtr is not None and pgtr != "":
                    try:
                        result["pgtr_ntby_qty"] = int(pgtr)
                    except (ValueError, TypeError):
                        pass
        except Exception:
            pass

        # 2) financial-ratio -> roe, 부채비율, 영업이익률, 매출액증가율
        #    (profit-ratio 별도 호출 불필요: bsop_prfi_inrt가 이미 포함)
        try:
            fin_data = self.client.get_financial_ratio(stock_code)
            if fin_data.get("rt_cd") == "0":
                items = fin_data.get("output", [])
                if items:
                    latest = items[0]
                    result["roe"] = safe_float(latest.get("roe_val"))
                    result["debt_ratio"] = safe_float(latest.get("lblt_rate"))
                    result["eps_growth"] = safe_float(latest.get("grs"))
                    result["opm"] = safe_float(latest.get("bsop_prfi_inrt"))
        except Exception:
            pass

        # PEG 계산
        if result["per"] and result["eps_growth"] and result["eps_growth"] > 0:
            result["peg"] = round(result["per"] / result["eps_growth"], 2)

        return result

    def collect_all_fundamentals(
        self,
        stocks: List[Dict],
        daily_price_data: Dict[str, List] = None,
    ) -> Dict[str, Dict]:
        """여러 종목의 펀더멘탈 데이터 일괄 수집

        Args:
            stocks: 종목 리스트 [{"code": ..., "name": ...}, ...]
            daily_price_data: {종목코드: output2 리스트} (RSI 계산용, 선택)

        Returns:
            {종목코드: {"per": ..., "pbr": ..., ...}, ...}
        """
        result = {}
        total = len(stocks)

        for idx, stock in enumerate(stocks):
            code = stock.get("code", "")
            if not code:
                continue

            try:
                fundamental = self.collect_fundamental(code)

                # RSI 계산 (일봉 데이터가 있으면)
                if daily_price_data and code in daily_price_data:
                    fundamental["rsi"] = self.calculate_rsi(daily_price_data[code])

                result[code] = fundamental
            except Exception as e:
                print(f"  \u26a0 {stock.get('name', code)}({code}) 펀더멘탈 조회 실패: {e}")

            if (idx + 1) % 10 == 0 or idx + 1 == total:
                print(f"  진행: {idx + 1}/{total}")

        return result
