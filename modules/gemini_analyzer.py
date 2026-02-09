"""
Gemini AI 기반 테마/대장주 분석 모듈

Google Search grounding을 활용하여 최신 뉴스 기반 시장 테마 분석
"""
import json
import re
import time
import requests
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional

from config.settings import GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3

KST = timezone(timedelta(hours=9))

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


def _get_api_keys() -> List[str]:
    """사용 가능한 API 키 목록 반환"""
    keys = [GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3]
    return [k for k in keys if k]


def _build_stock_context(stock_data: Dict[str, Any]) -> str:
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

    # 하락 TOP10
    falling_kospi = stock_data.get("falling", {}).get("kospi", [])[:10]
    falling_kosdaq = stock_data.get("falling", {}).get("kosdaq", [])[:10]
    if falling_kospi or falling_kosdaq:
        lines.append("\n## 하락률 TOP 종목")
        for s in falling_kospi:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스피 {s.get('change_rate', 0):.2f}% 현재가:{s.get('current_price', 0):,}원 거래량:{s.get('volume', 0):,}")
        for s in falling_kosdaq:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스닥 {s.get('change_rate', 0):.2f}% 현재가:{s.get('current_price', 0):,}원 거래량:{s.get('volume', 0):,}")

    # 거래량 TOP10
    vol_kospi = stock_data.get("volume", {}).get("kospi", [])[:10]
    vol_kosdaq = stock_data.get("volume", {}).get("kosdaq", [])[:10]
    if vol_kospi or vol_kosdaq:
        lines.append("\n## 거래량 TOP 종목")
        for s in vol_kospi:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스피 등락:{s.get('change_rate', 0):.2f}% 거래량:{s.get('volume', 0):,}")
        for s in vol_kosdaq:
            lines.append(f"- {s.get('name')}({s.get('code')}) 코스닥 등락:{s.get('change_rate', 0):.2f}% 거래량:{s.get('volume', 0):,}")

    # 거래대금 TOP10
    tv_kospi = stock_data.get("trading_value", {}).get("kospi", [])[:10]
    tv_kosdaq = stock_data.get("trading_value", {}).get("kosdaq", [])[:10]
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

    return "\n".join(lines)


def _build_prompt(stock_context: str) -> str:
    """Gemini 프롬프트 생성"""
    today = datetime.now(KST).strftime("%Y년 %m월 %d일")
    return f"""당신은 한국 주식시장 전문 애널리스트입니다. 오늘은 {today}입니다.

아래는 오늘 한국 주식시장에서 수집된 실시간 종목 데이터입니다:

{stock_context}

위 데이터를 바탕으로 다음 작업을 수행하세요:

1. 각 종목에 대해 Google 뉴스를 검색하여 최신 금융 뉴스 10개를 수집하세요.
2. 수집된 뉴스와 종목 데이터를 분석하여 현재 시장의 핵심 투자 테마 3~5개를 도출하세요.
3. 각 테마별 대장주 1~3개를 선정하고, 해당 종목이 대장주인 이유를 설명하세요.
4. 각 대장주에 대한 뉴스 근거를 2~4개 제시하세요 (뉴스 제목과 URL).
5. 시장 전체 상황을 1~2문장으로 요약하세요.

중요:
- 반드시 오늘({today}) 기준의 최신 뉴스만 참고하세요.
- 과거 학습 데이터가 아닌 Google Search를 통해 실시간 뉴스를 확인하세요.
- 뉴스 URL은 실제 접근 가능한 URL이어야 합니다.
- 종목 코드는 위 데이터에서 제공된 코드를 정확히 사용하세요.

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이 JSON만):
```json
{{
  "market_summary": "시장 요약 1~2문장",
  "themes": [
    {{
      "theme_name": "테마명",
      "theme_description": "테마 설명",
      "leader_stocks": [
        {{
          "name": "종목명",
          "code": "종목코드",
          "reason": "대장주 선정 이유",
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
            "temperature": 0.7,
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


def analyze_themes(stock_data: Dict[str, Any]) -> Optional[Dict]:
    """수집된 종목 데이터로 AI 테마 분석 수행

    Args:
        stock_data: rising, falling, volume, trading_value 등 수집 데이터

    Returns:
        분석 결과 dict 또는 실패 시 None
    """
    api_keys = _get_api_keys()
    if not api_keys:
        print("  ⚠ Gemini API 키가 설정되지 않았습니다")
        return None

    stock_context = _build_stock_context(stock_data)
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
