"""종목 선정 기준 평가 모듈

7개 기준에 따라 각 종목의 충족 여부를 판정하고 근거를 반환한다.
1. 전고점 돌파 (빨간색)
2. 끼 보유 (주황색)
3. 심리적 저항선 돌파 (노랑색)
4. 이동평균선 정배열 (초록색)
5. 외국인/기관 수급 (파랑색)
5-2. 프로그램 매매 (형광색)
6. 거래대금 TOP30 (분홍색)
"""

from typing import Dict, List, Any, Optional


# ── 호가 단위 경계 ──────────────────────────────────────────
TICK_BOUNDARIES = [2000, 5000, 20000, 50000, 200000, 500000]

# ── 심리적 라운드 넘버 기준 ──────────────────────────────────
ROUND_LEVELS = [
    (500_000, 100_000),   # 50만 이상: 10만 단위
    (100_000, 50_000),    # 10만 이상: 5만 단위
    (50_000, 10_000),     # 5만 이상: 1만 단위
    (20_000, 5_000),      # 2만 이상: 5천 단위
    (10_000, 1_000),      # 1만 이상: 1천 단위
    (5_000, 500),         # 5천 이상: 500 단위
    (1_000, 100),         # 1천 이상: 100 단위
]


def _safe_int(value) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


# ────────────────────────────────────────────────────────────
# 1. 전고점 돌파 (빨간색)
# ────────────────────────────────────────────────────────────

def check_high_breakout(
    current_price: int,
    daily_prices: List[Dict],
    w52_hgpr: Optional[int] = None,
) -> Dict[str, Any]:
    """최근 6개월(≈120영업일) 최고가 돌파 여부 + 52주 신고가 여부"""
    result = {"met": False, "is_52w_high": False, "reason": None}

    if not current_price:
        return result

    # 6개월 최고가 (일봉 고가 기준, 최신순 → 120개)
    highs = []
    for p in daily_prices[:120]:
        h = _safe_int(p.get("stck_hgpr") or p.get("stck_high"))
        if h:
            highs.append(h)

    if highs:
        six_month_high = max(highs)
        if current_price >= six_month_high:
            result["met"] = True
            result["reason"] = f"6개월 최고가 {six_month_high:,}원 돌파 (현재가 {current_price:,}원)"

    # 52주 신고가
    if w52_hgpr and current_price >= w52_hgpr:
        result["met"] = True
        result["is_52w_high"] = True
        result["reason"] = f"52주 신고가 경신 (기존 {w52_hgpr:,}원 → 현재 {current_price:,}원)"

    return result


# ────────────────────────────────────────────────────────────
# 2. 끼 보유 여부 (주황색)
# ────────────────────────────────────────────────────────────

def check_momentum_history(daily_prices: List[Dict]) -> Dict[str, Any]:
    """과거 상한가 이력 또는 +15% 이상 상승 종가 유지 이력"""
    result = {"met": False, "had_limit_up": False, "had_15pct_rise": False, "reason": None}

    if not daily_prices:
        return result

    reasons = []
    for p in daily_prices:
        change_str = p.get("prdy_ctrt") or p.get("prdy_vrss_sign_name")
        change_rate = None
        # 등락률 직접 계산: (종가 - 전일종가) / 전일종가
        close = _safe_int(p.get("stck_clpr"))
        prev_close = _safe_int(p.get("stck_sdpr"))  # 시작가 or 기준가
        if close and prev_close and prev_close > 0:
            change_rate = (close - prev_close) / prev_close * 100
        elif change_str:
            try:
                change_rate = float(change_str)
            except (ValueError, TypeError):
                pass

        if change_rate is None:
            continue

        date_str = p.get("stck_bsop_date", "")
        formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}" if len(date_str) == 8 else date_str

        if change_rate >= 29.0 and not result["had_limit_up"]:
            result["had_limit_up"] = True
            result["met"] = True
            reasons.append(f"상한가 기록 ({formatted}, +{change_rate:.1f}%)")

        if change_rate >= 15.0 and not result["had_15pct_rise"]:
            result["had_15pct_rise"] = True
            result["met"] = True
            reasons.append(f"+15% 이상 상승 유지 ({formatted}, +{change_rate:.1f}%)")

        if result["had_limit_up"] and result["had_15pct_rise"]:
            break

    if reasons:
        result["reason"] = " | ".join(reasons)

    return result


# ────────────────────────────────────────────────────────────
# 3. 심리적 저항선 돌파 (노랑색)
# ────────────────────────────────────────────────────────────

def check_resistance_breakout(
    current_price: int,
    prev_close: Optional[int] = None,
) -> Dict[str, Any]:
    """호가 단위 변경 구간 또는 라운드 넘버 돌파 여부"""
    result = {"met": False, "reason": None}

    if not current_price:
        return result

    reasons = []

    # 호가 단위 경계 돌파
    if prev_close:
        for boundary in TICK_BOUNDARIES:
            # 전일 종가가 경계 아래, 현재가가 경계 이상
            if prev_close < boundary <= current_price:
                reasons.append(f"호가 단위 변경 구간 {boundary:,}원 돌파 (전일 {prev_close:,} → 현재 {current_price:,})")
                break
            # 현재가가 경계 직전 (아래에서 ±3% 이내 접근)
            if prev_close < boundary and current_price < boundary:
                pct = (boundary - current_price) / boundary * 100
                if pct <= 3:
                    reasons.append(f"호가 단위 변경 구간 {boundary:,}원 돌파 직전 ({pct:.1f}% 남음)")
                    break

    # 라운드 넘버 돌파
    if prev_close:
        for threshold, unit in ROUND_LEVELS:
            if current_price >= threshold:
                # 전일 종가와 현재가 사이에 라운드 넘버가 있는지
                lower_round = (prev_close // unit + 1) * unit
                if prev_close < lower_round <= current_price:
                    reasons.append(f"심리적 저항선 {lower_round:,}원 돌파")
                break

    if reasons:
        result["met"] = True
        result["reason"] = " | ".join(reasons)

    return result


# ────────────────────────────────────────────────────────────
# 4. 이동평균선 정배열 (초록색)
# ────────────────────────────────────────────────────────────

def _calc_sma(closes: List[int], period: int) -> Optional[float]:
    """단순 이동평균 계산"""
    if len(closes) < period:
        return None
    return sum(closes[:period]) / period


def check_ma_alignment(current_price: int, daily_prices: List[Dict]) -> Dict[str, Any]:
    """모든 이동평균선(5/10/20/60/120)이 정배열인지"""
    result = {"met": False, "ma_values": {}, "reason": None}

    if not current_price or not daily_prices:
        return result

    # 최신순 종가 배열
    closes = []
    for p in daily_prices:
        c = _safe_int(p.get("stck_clpr"))
        if c:
            closes.append(c)

    periods = [5, 10, 20, 60, 120]
    ma_values = {}
    for period in periods:
        ma = _calc_sma(closes, period)
        if ma is not None:
            ma_values[f"MA{period}"] = round(ma)

    result["ma_values"] = ma_values

    if len(ma_values) < len(periods):
        result["reason"] = f"이동평균 계산 불가 (데이터 부족: {len(closes)}일분)"
        return result

    # 정배열: 현재가 > MA5 > MA10 > MA20 > MA60 > MA120
    values = [current_price] + [ma_values[f"MA{p}"] for p in periods]
    is_aligned = all(values[i] > values[i + 1] for i in range(len(values) - 1))

    if is_aligned:
        result["met"] = True
        parts = [f"현재가({current_price:,})"]
        for p in periods:
            parts.append(f"MA{p}({ma_values[f'MA{p}']:,})")
        result["reason"] = " > ".join(parts) + " 정배열"
    else:
        parts = []
        for p in periods:
            parts.append(f"MA{p}:{ma_values[f'MA{p}']:,}")
        result["reason"] = "정배열 미충족 (" + " | ".join(parts) + ")"

    return result


# ────────────────────────────────────────────────────────────
# 5. 외국인/기관 수급 (파랑색)
# ────────────────────────────────────────────────────────────

def check_supply_demand(
    investor_info: Optional[Dict] = None,
) -> Dict[str, Any]:
    """외국인 + 기관 동시 순매수 여부"""
    result = {"met": False, "reason": None}

    foreign_net = investor_info.get("foreign_net", 0) if investor_info else 0
    institution_net = investor_info.get("institution_net", 0) if investor_info else 0

    if foreign_net and foreign_net > 0 and institution_net and institution_net > 0:
        result["met"] = True

    parts = []
    if foreign_net:
        sign = "+" if foreign_net > 0 else ""
        parts.append(f"외국인 {sign}{foreign_net:,}주")
    if institution_net:
        sign = "+" if institution_net > 0 else ""
        parts.append(f"기관 {sign}{institution_net:,}주")

    if parts:
        result["reason"] = " | ".join(parts)

    return result


# ────────────────────────────────────────────────────────────
# 5-2. 프로그램 매매 (형광색)
# ────────────────────────────────────────────────────────────

def check_program_trading(
    pgtr_ntby_qty: Optional[int] = None,
) -> Dict[str, Any]:
    """프로그램 순매수 여부"""
    result = {"met": False, "reason": None}

    pgtr = pgtr_ntby_qty or 0

    if pgtr > 0:
        result["met"] = True
        result["reason"] = f"프로그램 순매수 +{pgtr:,}주"
    elif pgtr < 0:
        result["reason"] = f"프로그램 순매도 {pgtr:,}주"

    return result


# ────────────────────────────────────────────────────────────
# 6. 거래대금 TOP30 포함 여부 (분홍색)
# ────────────────────────────────────────────────────────────

def check_top30_trading_value(
    stock_code: str,
    trading_value_top30_codes: set,
) -> Dict[str, Any]:
    """당일 거래대금 TOP30에 포함되는지"""
    result = {"met": False, "reason": None}

    if stock_code in trading_value_top30_codes:
        result["met"] = True
        result["reason"] = "당일 거래대금 TOP30 포함"

    return result


# ────────────────────────────────────────────────────────────
# 통합 평가
# ────────────────────────────────────────────────────────────

def evaluate_stock_criteria(
    stock: Dict[str, Any],
    daily_prices: List[Dict],
    fundamental: Optional[Dict] = None,
    investor_info: Optional[Dict] = None,
    trading_value_top30_codes: set = None,
) -> Dict[str, Any]:
    """단일 종목에 대해 6개 기준 모두 평가

    Args:
        stock: 종목 정보 (code, name, current_price, change_price 등)
        daily_prices: 일봉 데이터 (최신순 정렬)
        fundamental: 펀더멘탈 데이터 (w52_hgpr, pgtr_ntby_qty 등)
        investor_info: 수급 데이터 (foreign_net, institution_net)
        trading_value_top30_codes: 거래대금 TOP30 종목코드 집합

    Returns:
        6개 기준 평가 결과 dict
    """
    current_price = stock.get("current_price", 0)
    change_price = stock.get("change_price", 0)
    prev_close = current_price - change_price if current_price and change_price else None

    w52_hgpr = fundamental.get("w52_hgpr") if fundamental else None
    pgtr = fundamental.get("pgtr_ntby_qty") if fundamental else None

    if trading_value_top30_codes is None:
        trading_value_top30_codes = set()

    criteria = {
        "high_breakout": check_high_breakout(current_price, daily_prices, w52_hgpr),
        "momentum_history": check_momentum_history(daily_prices),
        "resistance_breakout": check_resistance_breakout(current_price, prev_close),
        "ma_alignment": check_ma_alignment(current_price, daily_prices),
        "supply_demand": check_supply_demand(investor_info),
        "program_trading": check_program_trading(pgtr),
        "top30_trading_value": check_top30_trading_value(stock.get("code", ""), trading_value_top30_codes),
    }

    all_met = all(c["met"] for c in criteria.values())
    criteria["all_met"] = all_met

    return criteria


def evaluate_all_stocks(
    all_stocks: List[Dict],
    history_data: Dict[str, Dict],
    fundamental_data: Dict[str, Dict] = None,
    investor_data: Dict[str, Dict] = None,
    trading_value_data: Dict = None,
) -> Dict[str, Dict]:
    """모든 종목에 대해 기준 평가 실행

    Returns:
        {종목코드: {criteria_results}} 딕셔너리
    """
    if fundamental_data is None:
        fundamental_data = {}
    if investor_data is None:
        investor_data = {}

    # 거래대금 TOP30 종목 코드 집합 구성
    tv_top30_codes = set()
    if trading_value_data:
        for s in trading_value_data.get("kospi", [])[:30]:
            tv_top30_codes.add(s.get("code", ""))
        for s in trading_value_data.get("kosdaq", [])[:30]:
            tv_top30_codes.add(s.get("code", ""))

    result = {}
    total = len(all_stocks)

    for idx, stock in enumerate(all_stocks):
        code = stock.get("code", "")
        if not code:
            continue

        # 일봉 데이터 (최신순)
        raw_daily = history_data.get(code, {}).get("raw_daily_prices", [])

        criteria = evaluate_stock_criteria(
            stock=stock,
            daily_prices=raw_daily,
            fundamental=fundamental_data.get(code),
            investor_info=investor_data.get(code),
            trading_value_top30_codes=tv_top30_codes,
        )
        result[code] = criteria

        if (idx + 1) % 50 == 0 or idx + 1 == total:
            print(f"  진행: {idx + 1}/{total}")

    return result
