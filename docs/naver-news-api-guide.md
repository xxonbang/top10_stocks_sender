# 네이버 검색 API를 활용한 종목별 뉴스 수집 가이드

## 개요

네이버 검색 API의 뉴스 검색 기능을 활용하여 주식 종목별 최신 뉴스 3건을 수집하는 방법을 설명합니다.

### 주요 특징
- 종목명 기반 뉴스 검색 (예: "삼성전자 주식")
- 최신순 정렬로 실시간 뉴스 제공
- Rate limit 대응 (429 에러 시 exponential backoff 재시도)
- HTML 태그 자동 제거 및 날짜 형식 정규화

---

## 1. 네이버 개발자 등록 및 API 키 발급

### 1.1 애플리케이션 등록

1. [네이버 개발자 센터](https://developers.naver.com) 접속
2. 로그인 후 **Application > 애플리케이션 등록** 클릭
3. 애플리케이션 정보 입력:
   - **애플리케이션 이름**: 프로젝트명 (예: "Stock News Collector")
   - **사용 API**: `검색` 선택
   - **비로그인 오픈 API 서비스 환경**: `WEB 설정` 또는 `서버` 선택

### 1.2 API 키 확인

등록 완료 후 발급되는 키:
- **Client ID**: `X-Naver-Client-Id` 헤더에 사용
- **Client Secret**: `X-Naver-Client-Secret` 헤더에 사용

### 1.3 API 사용량 제한

| 구분 | 제한 |
|------|------|
| 일일 호출 한도 | 25,000건 (무료) |
| 초당 호출 제한 | 명시되지 않음 (약 10건/초 권장) |
| 검색 결과 | 최대 100건/요청 |

---

## 2. API 명세

### 2.1 엔드포인트

```
GET https://openapi.naver.com/v1/search/news.json
```

### 2.2 요청 헤더

| 헤더명 | 필수 | 설명 |
|--------|------|------|
| `X-Naver-Client-Id` | O | 애플리케이션 등록 시 발급받은 Client ID |
| `X-Naver-Client-Secret` | O | 애플리케이션 등록 시 발급받은 Client Secret |

### 2.3 요청 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `query` | string | O | - | 검색어 (UTF-8 인코딩) |
| `display` | int | X | 10 | 검색 결과 개수 (1~100) |
| `start` | int | X | 1 | 검색 시작 위치 (1~1000) |
| `sort` | string | X | sim | 정렬 방식: `sim`(정확도순), `date`(최신순) |

### 2.4 응답 형식

```json
{
  "lastBuildDate": "Mon, 02 Feb 2026 23:00:00 +0900",
  "total": 12345,
  "start": 1,
  "display": 3,
  "items": [
    {
      "title": "<b>삼성전자</b> 주가 상승...",
      "originallink": "https://news.example.com/article/123",
      "link": "https://n.news.naver.com/article/...",
      "description": "<b>삼성전자</b>가 오늘 주가가...",
      "pubDate": "Mon, 02 Feb 2026 14:30:00 +0900"
    }
  ]
}
```

### 2.5 응답 필드 설명

| 필드 | 설명 |
|------|------|
| `title` | 뉴스 제목 (HTML 태그 포함) |
| `originallink` | 원본 기사 URL |
| `link` | 네이버 뉴스 URL (없으면 originallink와 동일) |
| `description` | 기사 요약 (HTML 태그 포함) |
| `pubDate` | 발행일시 (RFC 2822 형식) |

---

## 3. 구현 코드

### 3.1 기본 구조

```python
import requests
import re
import time
from datetime import datetime
from html import unescape
from typing import Dict, List, Any

class NaverNewsAPI:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        request_delay: float = 0.1,  # 요청 간 딜레이 (초)
        max_retries: int = 3,        # 최대 재시도 횟수
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.api_url = "https://openapi.naver.com/v1/search/news.json"
        self.request_delay = request_delay
        self.max_retries = max_retries
        self._last_request_time = 0
```

### 3.2 뉴스 검색 메서드

```python
def search_news(
    self,
    query: str,
    display: int = 3,
    sort: str = "date",
) -> List[Dict[str, Any]]:
    """뉴스 검색

    Args:
        query: 검색어 (종목명)
        display: 검색 결과 개수 (최대 100)
        sort: 정렬 방식 (date: 최신순, sim: 정확도순)

    Returns:
        뉴스 리스트
    """
    headers = {
        "X-Naver-Client-Id": self.client_id,
        "X-Naver-Client-Secret": self.client_secret,
    }

    params = {
        "query": query,
        "display": display,
        "start": 1,
        "sort": sort,
    }

    response = requests.get(
        self.api_url,
        headers=headers,
        params=params,
        timeout=10,
    )

    if response.status_code == 200:
        data = response.json()
        return data.get("items", [])

    return []
```

### 3.3 종목별 뉴스 수집

```python
def get_stock_news(self, stock_name: str, count: int = 3) -> List[Dict]:
    """종목명으로 뉴스 검색

    Args:
        stock_name: 종목명 (예: "삼성전자")
        count: 뉴스 개수

    Returns:
        뉴스 리스트
    """
    # 종목명 + "주식" 키워드 추가하여 관련성 높이기
    return self.search_news(f"{stock_name} 주식", display=count, sort="date")
```

### 3.4 여러 종목 일괄 수집

```python
def get_multiple_stocks_news(
    self,
    stocks: List[Dict[str, Any]],
    news_count: int = 3,
) -> Dict[str, Dict]:
    """여러 종목의 뉴스 일괄 수집

    Args:
        stocks: 종목 리스트 [{"code": "005930", "name": "삼성전자"}, ...]
        news_count: 종목당 뉴스 개수

    Returns:
        {종목코드: {"name": 종목명, "news": [뉴스리스트]}, ...}
    """
    result = {}

    for stock in stocks:
        code = stock.get("code", "")
        name = stock.get("name", "")

        if not name:
            continue

        news = self.get_stock_news(name, count=news_count)
        result[code] = {
            "name": name,
            "news": news,
        }

    return result
```

---

## 4. Rate Limit 대응

### 4.1 요청 간 딜레이

```python
def _wait_for_rate_limit(self):
    """Rate limit 대응을 위한 딜레이"""
    elapsed = time.time() - self._last_request_time
    if elapsed < self.request_delay:
        time.sleep(self.request_delay - elapsed)
    self._last_request_time = time.time()
```

### 4.2 Exponential Backoff 재시도

429 에러 (Too Many Requests) 발생 시 재시도:

```python
for attempt in range(self.max_retries):
    response = requests.get(self.api_url, headers=headers, params=params)

    if response.status_code == 200:
        return response.json().get("items", [])

    elif response.status_code == 429:
        # Exponential backoff: 0.5초, 1초, 2초
        wait_time = (2 ** attempt) * 0.5
        if attempt < self.max_retries - 1:
            time.sleep(wait_time)
            continue
        else:
            print(f"Rate limit 초과: 최대 재시도 횟수 도달")
            return []
```

---

## 5. 데이터 정제

### 5.1 HTML 태그 제거

```python
def _clean_html(self, text: str) -> str:
    """HTML 태그 및 특수문자 제거"""
    if not text:
        return ""
    # HTML 엔티티 디코딩 (&amp; -> &, &lt; -> < 등)
    text = unescape(text)
    # HTML 태그 제거
    text = re.sub(r'<[^>]+>', '', text)
    # 연속 공백 제거
    text = re.sub(r'\s+', ' ', text).strip()
    return text
```

### 5.2 날짜 형식 변환

```python
def _parse_date(self, date_str: str) -> str:
    """날짜 문자열 파싱

    입력: "Mon, 02 Feb 2026 14:30:00 +0900"
    출력: "02-02 14:30"
    """
    try:
        dt = datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %z")
        return dt.strftime("%m-%d %H:%M")
    except:
        return date_str[:16] if date_str else ""
```

---

## 6. 사용 예시

### 6.1 환경 변수 설정

```bash
# .env 파일
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret
```

### 6.2 단일 종목 뉴스 수집

```python
from modules.naver_news import NaverNewsAPI

# API 초기화
news_api = NaverNewsAPI()

# 삼성전자 뉴스 3건 수집
news = news_api.get_stock_news("삼성전자", count=3)

for item in news:
    print(f"제목: {item['title']}")
    print(f"링크: {item['link']}")
    print(f"날짜: {item['pubDate']}")
    print("---")
```

### 6.3 여러 종목 일괄 수집

```python
# 종목 리스트
stocks = [
    {"code": "005930", "name": "삼성전자"},
    {"code": "000660", "name": "SK하이닉스"},
    {"code": "035720", "name": "카카오"},
]

# 종목별 뉴스 3건씩 수집
all_news = news_api.get_multiple_stocks_news(stocks, news_count=3)

# 결과 출력
for code, data in all_news.items():
    print(f"\n📌 {data['name']} ({code})")
    for news in data['news']:
        print(f"  • {news['title']}")
        print(f"    {news['pubDate']}")
```

### 6.4 출력 결과 예시

```
📌 삼성전자 (005930)
  • 삼성전자, 1분기 실적 예상치 상회... 반도체 회복세
    02-02 14:30
  • 삼성전자 주가 상승, 외국인 순매수 지속
    02-02 11:45
  • 삼성전자 AI 반도체 투자 확대 발표
    02-02 09:20

📌 SK하이닉스 (000660)
  • SK하이닉스, HBM3E 양산 본격화
    02-02 13:15
  ...
```

---

## 7. 최종 데이터 구조

### 7.1 뉴스 아이템 구조

```json
{
  "title": "삼성전자 주가 상승, 외국인 순매수 지속",
  "link": "https://n.news.naver.com/article/...",
  "description": "삼성전자가 오늘 외국인 매수세에...",
  "pubDate": "02-02 14:30",
  "originallink": "https://news.example.com/article/123"
}
```

### 7.2 종목별 뉴스 구조

```json
{
  "005930": {
    "name": "삼성전자",
    "news": [
      {"title": "...", "link": "...", "pubDate": "..."},
      {"title": "...", "link": "...", "pubDate": "..."},
      {"title": "...", "link": "...", "pubDate": "..."}
    ]
  },
  "000660": {
    "name": "SK하이닉스",
    "news": [...]
  }
}
```

---

## 8. 주의사항

1. **검색어 최적화**: `종목명 + "주식"` 조합으로 관련성 향상
2. **Rate Limit**: 요청 간 0.1초 이상 딜레이 권장
3. **일일 한도**: 25,000건 초과 시 다음 날까지 사용 불가
4. **HTML 정제**: `<b>` 등 검색어 하이라이트 태그 제거 필요
5. **타임아웃**: 네트워크 지연 대비 10초 타임아웃 설정

---

## 9. 참고 자료

- [네이버 개발자 센터](https://developers.naver.com)
- [검색 API 문서](https://developers.naver.com/docs/serviceapi/search/news/news.md)
- [API 에러 코드](https://developers.naver.com/docs/common/openapiguide/errorcode.md)
