"""
Gemini AI 기반 테마/대장주 분석 모듈

Google Search grounding을 활용하여 최신 뉴스 기반 시장 테마 분석
"""
import json
import re
import time
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional

from config.settings import GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, GEMINI_API_KEY_4, GEMINI_API_KEY_5
from modules.utils import KST

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


def _get_api_keys() -> List[str]:
    """사용 가능한 API 키 목록 반환"""
    keys = [GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, GEMINI_API_KEY_4, GEMINI_API_KEY_5]
    return [k for k in keys if k]


def _build_stock_context(stock_data: Dict[str, Any], fundamental_data: Dict[str, Dict] = None, investor_data: Dict[str, Dict] = None) -> str:
    """수집된 종목 데이터에서 Gemini 프롬프트용 컨텍스트 생성"""
    lines = []

    # 상승 TOP10
    rising_kospi = stock_data.get("rising", {}).get("kospi", [])[:10]
    rising_kosdaq = stock_data.get("rising", {}).get("kosdaq", [])[:10]
    if rising_kospi or rising_kosdaq:
        lines.append("## 상승률 TOP 종목")
        for s in rising_kospi:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스피 +{s.get('change_rate', 0):.2f}% 현재가:{s.get('current_price', 0):,}원 거래량:{s.get('volume', 0):,}")
        for s in rising_kosdaq:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스닥 +{s.get('change_rate', 0):.2f}% 현재가:{s.get('current_price', 0):,}원 거래량:{s.get('volume', 0):,}")

    # 거래량 TOP10
    vol_kospi = stock_data.get("volume", {}).get("kospi", [])[:20]
    vol_kosdaq = stock_data.get("volume", {}).get("kosdaq", [])[:20]
    if vol_kospi or vol_kosdaq:
        lines.append("\n## 거래량 TOP 종목")
        for s in vol_kospi:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스피 등락:{s.get('change_rate', 0):.2f}% 거래량:{s.get('volume', 0):,}")
        for s in vol_kosdaq:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스닥 등락:{s.get('change_rate', 0):.2f}% 거래량:{s.get('volume', 0):,}")

    # 거래대금 TOP10
    tv_kospi = stock_data.get("trading_value", {}).get("kospi", [])[:20]
    tv_kosdaq = stock_data.get("trading_value", {}).get("kosdaq", [])[:20]
    if tv_kospi or tv_kosdaq:
        lines.append("\n## 거래대금 TOP 종목")
        for s in tv_kospi:
            tv = s.get("trading_value", 0)
            tv_str = f"{tv / 100_000_000:,.0f}억원" if tv else "N/A"
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스피 등락:{s.get('change_rate', 0):.2f}% 거래대금:{tv_str}")
        for s in tv_kosdaq:
            tv = s.get("trading_value", 0)
            tv_str = f"{tv / 100_000_000:,.0f}억원" if tv else "N/A"
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스닥 등락:{s.get('change_rate', 0):.2f}% 거래대금:{tv_str}")

    # 등락률 TOP10
    fluc = stock_data.get("fluctuation", {})
    fluc_kospi_up = fluc.get("kospi_up", [])[:20]
    fluc_kosdaq_up = fluc.get("kosdaq_up", [])[:20]
    if fluc_kospi_up or fluc_kosdaq_up:
        lines.append("\n## 등락률 상승 TOP 종목")
        for s in fluc_kospi_up:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스피 +{s.get('change_rate', 0):.2f}% 현재가:{s.get('current_price', 0):,}원")
        for s in fluc_kosdaq_up:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스닥 +{s.get('change_rate', 0):.2f}% 현재가:{s.get('current_price', 0):,}원")
    # 거래대금+상승률 교차 필터 (거래대금 순서 기준, 등락률 상승 TOP에도 포함된 종목)
    fluc_up_codes = set(
        s.get("code", "") for s in fluc.get("kospi_up", []) + fluc.get("kosdaq_up", [])
    )
    tv_all_kospi = stock_data.get("trading_value", {}).get("kospi", [])
    tv_all_kosdaq = stock_data.get("trading_value", {}).get("kosdaq", [])

    cross_kospi_up = [s for s in tv_all_kospi if s.get("code", "") in fluc_up_codes][:10]
    cross_kosdaq_up = [s for s in tv_all_kosdaq if s.get("code", "") in fluc_up_codes][:10]
    if cross_kospi_up or cross_kosdaq_up:
        lines.append("\n## 거래대금+상승률 교차 종목 (대금 순)")
        for s in cross_kospi_up:
            tv = s.get("trading_value", 0)
            tv_str = f"{tv / 100_000_000:,.0f}억원" if tv else "N/A"
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스피 등락:+{s.get('change_rate', 0):.2f}% 거래대금:{tv_str}")
        for s in cross_kosdaq_up:
            tv = s.get("trading_value", 0)
            tv_str = f"{tv / 100_000_000:,.0f}억원" if tv else "N/A"
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스닥 등락:+{s.get('change_rate', 0):.2f}% 거래대금:{tv_str}")

    # 종목코드 → 종목명 매핑 구성 (펀더멘탈/수급 섹션에서 공용)
    code_to_name = {}
    all_sections = [
        stock_data.get("rising", {}),
        stock_data.get("falling", {}),
        stock_data.get("volume", {}),
        stock_data.get("trading_value", {}),
    ]
    fluc_data = stock_data.get("fluctuation", {})
    for section in all_sections:
        for market_stocks in section.values():
            if isinstance(market_stocks, list):
                for s in market_stocks:
                    c = s.get("code", "")
                    if c:
                        code_to_name[c] = s.get("name", c)
    for key in ("kospi_up", "kospi_down", "kosdaq_up", "kosdaq_down"):
        for s in fluc_data.get(key, []):
            c = s.get("code", "")
            if c:
                code_to_name[c] = s.get("name", c)

    # 펀더멘탈 데이터 섹션
    if fundamental_data:
        lines.append("\n## 종목별 밸류에이션/재무 지표")
        for code, f in fundamental_data.items():
            name = code_to_name.get(code, code)
            parts = []
            if f.get("per") is not None:
                parts.append(f"PER:{f['per']}")
            if f.get("pbr") is not None:
                parts.append(f"PBR:{f['pbr']}")
            if f.get("eps") is not None:
                parts.append(f"EPS:{f['eps']:,.0f}원")
            if f.get("market_cap") is not None:
                parts.append(f"시총:{f['market_cap']:,.0f}억")
            if f.get("roe") is not None:
                parts.append(f"ROE:{f['roe']}%")
            if f.get("opm") is not None:
                parts.append(f"OPM:{f['opm']}%")
            if f.get("debt_ratio") is not None:
                parts.append(f"부채비율:{f['debt_ratio']}%")
            if f.get("peg") is not None:
                parts.append(f"PEG:{f['peg']}")
            if f.get("rsi") is not None:
                parts.append(f"RSI:{f['rsi']:.1f}")
            if parts:
                lines.append(f"- {name}({code}): {' | '.join(parts)}")

    # 외국인/기관 수급 데이터 섹션
    if investor_data:
        lines.append("\n## 종목별 외국인/기관 수급 동향")
        for code, inv in investor_data.items():
            name = code_to_name.get(code, code)
            parts = []
            foreign = inv.get("foreign_net")
            institution = inv.get("institution_net")
            individual = inv.get("individual_net")
            if foreign is not None and foreign != 0:
                sign = "+" if foreign > 0 else ""
                parts.append(f"외국인:{sign}{foreign:,}주")
            if institution is not None and institution != 0:
                sign = "+" if institution > 0 else ""
                parts.append(f"기관:{sign}{institution:,}주")
            if individual is not None and individual != 0:
                sign = "+" if individual > 0 else ""
                parts.append(f"개인:{sign}{individual:,}주")
            if parts:
                lines.append(f"- {name}({code}): {' | '.join(parts)}")

    # 프로그램 매매 데이터 섹션 (fundamental_data에서 추출)
    if fundamental_data:
        pgtr_lines = []
        for code, f in fundamental_data.items():
            pgtr = f.get("pgtr_ntby_qty")
            if pgtr is not None and pgtr != 0:
                name = code_to_name.get(code, code)
                sign = "+" if pgtr > 0 else ""
                label = "순매수" if pgtr > 0 else "순매도"
                pgtr_lines.append(f"- {name}({code}): 프로그램 {label} {sign}{pgtr:,}주")
        if pgtr_lines:
            lines.append("\n## 종목별 프로그램 매매 동향")
            lines.extend(pgtr_lines)

    return "\n".join(lines)


def _build_prompt(stock_context: str) -> str:
    """Gemini 프롬프트 생성"""
    today = datetime.now(KST).strftime("%Y년 %m월 %d일")
    return f"""당신은 한국 주식시장 전문 애널리스트입니다. 오늘은 {today}입니다.

아래는 오늘 한국 주식시장에서 수집된 실시간 종목 데이터입니다:

{stock_context}

### 분석 목표
오늘의 한국 주식시장에서 핵심 투자 테마 3~5개를 도출하고, 각 테마의 대장주를 선정하세요.

### 데이터 활용 방법
- 위에 제공된 종목 데이터(등락률, 거래대금, 거래량, 밸류에이션, 수급, 프로그램 매매)를 1차 근거로 사용
- Google Search로 각 종목의 최신 뉴스를 검색하여 테마 연관성 확인 (반드시 오늘 {today} 기준)
- Google Search로 "{{종목명}} 실적" 키워드를 검색하여 최신 실적 정보 보완
- 과거 학습 데이터가 아닌 Google Search를 통해 실시간 뉴스를 확인할 것

### 대장주 선정 기준
아래 기준을 종합적으로 평가하여 각 테마별 대장주 1~3개를 선정하세요:

1. **시장 주도력**: 거래대금 상위 + 상승률 상위에 동시 포함된 종목 우선
2. **테마 대표성**: 해당 테마를 가장 직접적으로 대표하는 사업 구조
3. **수급 강도**: 거래량 급증(거래량 TOP 포함 여부), 기관/외국인 수급 방향
4. **밸류에이션 적정성**: PER/PBR이 동종업계 대비 과도하지 않은 종목 우선
5. **뉴스 모멘텀**: 오늘 기준 긍정적 뉴스(수주, 실적, 정책 수혜 등)가 있는 종목
6. **프로그램 매매**: 프로그램 순매수 종목 우선, 대규모 프로그램 매매가 유입된 종목 주목

### 밸류에이션 평가 기준
각 대장주에 대해 아래 지표를 활용하되, **동일 업종/섹터 평균 대비 상대적으로** 평가하세요:
- PER/PBR: 절대 수치만으로 판단하지 말고, Google Search로 동종업계 평균 PER을 확인하여 비교
- ROE > 15%: 자본 효율성 우수
- PEG < 1: 성장성 대비 저평가
- RSI > 70: 과매수 구간, RSI < 30: 과매도 구간

### 주의사항
- 뉴스 URL은 실제 접근 가능한 URL이어야 합니다.
- 종목 코드는 위 데이터에서 제공된 코드를 정확히 사용하세요.
- 각 대장주에 대한 뉴스 근거를 2~4개 제시하세요 (뉴스 제목과 URL).
- 시장 전체 상황을 1~2문장으로 요약하세요.
- reason에서 언급한 뉴스 내용은 반드시 news_evidence에도 포함되어야 합니다. reason과 news_evidence 간 내용이 일치해야 합니다.

### 출력 형식
반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이 JSON만):
```json
{{
  "market_summary": "시장 요약 1~2문장",
  "themes": [
    {{
      "theme_name": "테마명",
      "theme_description": "이 테마가 오늘 부각된 구체적 배경과 촉매 (정책 발표, 실적 시즌, 글로벌 이벤트 등)",
      "leader_stocks": [
        {{
          "name": "종목명",
          "code": "종목코드",
          "reason": "대장주 선정 이유 — 반드시 제공된 데이터의 구체적 수치를 인용 (예: 거래대금 1,200억원 코스닥 1위, 외국인 +52만주, RSI 65). 뉴스 근거도 함께 포함.",
          "valuation": "밸류에이션 평가 — 동종업계 PER 대비 상대 평가 포함 (예: 업종 평균 PER 15배 대비 현재 8배로 저평가)",
          "news_evidence": [
            {{"title": "뉴스 제목", "url": "뉴스 URL"}}
          ]
        }}
      ]
    }}
  ]
}}
```"""


def _extract_json(text: str) -> Optional[Dict]:
    """응답 텍스트에서 JSON 블록 추출"""
    # ```json ... ``` 블록 추출
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    # ``` ... ``` 블록 추출
    match = re.search(r"```\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        candidate = match.group(1).strip()
        if candidate.startswith("{"):
            return json.loads(candidate)
    # 전체 텍스트에서 JSON 오브젝트 추출
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return None


def _call_gemini(prompt: str, api_key: str) -> Optional[Dict]:
    """Gemini API 호출 (Google Search grounding + 텍스트에서 JSON 파싱)"""
    url = f"{GEMINI_API_URL}?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {
            "temperature": 0.5,
        },
    }

    resp = requests.post(url, json=payload, timeout=120)
    resp.raise_for_status()

    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        return None

    content = candidates[0].get("content", {})
    parts = content.get("parts", [])

    # 텍스트 파트 결합
    text = ""
    for part in parts:
        if "text" in part:
            text += part["text"]

    if not text.strip():
        return None

    return _extract_json(text)


def analyze_themes(stock_data: Dict[str, Any], fundamental_data: Dict[str, Dict] = None, investor_data: Dict[str, Dict] = None) -> Optional[Dict]:
    """수집된 종목 데이터로 AI 테마 분석 수행

    Args:
        stock_data: rising, falling, volume, trading_value 등 수집 데이터
        fundamental_data: {종목코드: {"per": ..., "pbr": ..., ...}} 펀더멘탈 데이터 (프로그램 매매 포함)
        investor_data: {종목코드: {"foreign_net": ..., "institution_net": ..., ...}} 수급 데이터

    Returns:
        분석 결과 dict 또는 실패 시 None
    """
    api_keys = _get_api_keys()
    if not api_keys:
        print("  ⚠ Gemini API 키가 설정되지 않았습니다")
        return None

    stock_context = _build_stock_context(stock_data, fundamental_data, investor_data)
    if not stock_context.strip():
        print("  ⚠ 분석할 종목 데이터가 없습니다")
        return None

    prompt = _build_prompt(stock_context)

    max_retries_per_key = 3

    for key_idx, api_key in enumerate(api_keys):
        for attempt in range(max_retries_per_key):
            try:
                print(f"  Gemini API 호출 중... (키 {key_idx + 1}/{len(api_keys)}, 시도 {attempt + 1}/{max_retries_per_key})")
                result = _call_gemini(prompt, api_key)
                if result:
                    now = datetime.now(KST)
                    return {
                        "analyzed_at": now.strftime("%Y-%m-%d %H:%M:%S"),
                        "analysis_date": now.strftime("%Y년 %m월 %d일"),
                        "market_summary": result.get("market_summary", ""),
                        "themes": result.get("themes", []),
                    }
                print("  ⚠ Gemini 응답이 비어있습니다")
            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response is not None else 0
                if status in (429, 503):
                    if attempt < max_retries_per_key - 1:
                        wait = 2 ** (attempt + 1)
                        print(f"  ⚠ API 제한 ({status}), {wait}초 후 재시도...")
                        time.sleep(wait)
                        continue
                    else:
                        print(f"  ⚠ 키 {key_idx + 1} 재시도 소진, 다음 키로 전환")
                        break
                else:
                    print(f"  ✗ Gemini API 오류 ({status}): {e}")
                    return None
            except json.JSONDecodeError as e:
                print(f"  ⚠ Gemini 응답 JSON 파싱 실패: {e}")
                if attempt < max_retries_per_key - 1:
                    time.sleep(2)
                    continue
                break
            except Exception as e:
                print(f"  ✗ Gemini API 호출 실패: {e}")
                return None

    print("  ✗ 모든 Gemini API 키로 분석 실패")
    return None
