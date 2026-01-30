"""
한국투자증권 Open API 클라이언트
- OAuth 토큰 관리 (1일 1회 발급 제한 대응)
- API 호출 기본 기능

주의사항:
- 한국투자증권 API는 Access Token 발급이 1일 1회로 제한됩니다.
- 토큰은 24시간 유효하므로, 캐시된 토큰을 최대한 재사용합니다.
- 토큰이 만료되어도 먼저 사용을 시도하고, 실패 시에만 재발급합니다.
"""
import json
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import (
    KIS_APP_KEY,
    KIS_APP_SECRET,
    KIS_ACCOUNT_NO,
    KIS_BASE_URL,
    ROOT_DIR,
)


class TokenExpiredError(Exception):
    """토큰 만료 에러"""
    pass


class TokenRefreshLimitError(Exception):
    """토큰 재발급 제한 에러 (1일 1회 초과)"""
    pass


class KISClient:
    """한국투자증권 API 클라이언트

    토큰 관리 정책:
    1. 캐시된 토큰이 있으면 만료 여부와 관계없이 먼저 사용 시도
    2. API 호출 실패(401) 시에만 토큰 재발급 시도
    3. 재발급은 1일 1회 제한이므로, 마지막 발급 시간을 기록하여 중복 발급 방지
    """

    def __init__(self):
        self.app_key = KIS_APP_KEY
        self.app_secret = KIS_APP_SECRET
        self.account_no = KIS_ACCOUNT_NO
        self.base_url = KIS_BASE_URL

        # 토큰 캐시 파일 경로
        self._token_cache_path = ROOT_DIR / ".kis_token_cache.json"
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._token_issued_at: Optional[datetime] = None

        self._validate_credentials()
        self._load_cached_token()

    def _validate_credentials(self):
        """API 키 유효성 검사"""
        if not self.app_key:
            raise ValueError("KIS_APP_KEY 환경변수가 설정되지 않았습니다.")
        if not self.app_secret:
            raise ValueError("KIS_APP_SECRET 환경변수가 설정되지 않았습니다.")

    def _load_cached_token(self) -> bool:
        """캐시된 토큰 로드 (만료 여부와 관계없이 로드)"""
        if not self._token_cache_path.exists():
            return False

        try:
            with open(self._token_cache_path, 'r') as f:
                cache = json.load(f)

            token_data = cache.get("token", {})
            if not token_data:
                return False

            self._access_token = token_data.get('access_token')
            self._token_expires_at = datetime.fromisoformat(token_data['expires_at'])
            self._token_issued_at = datetime.fromisoformat(token_data['issued_at'])

            # 토큰 상태 출력
            remaining = self._token_expires_at - datetime.now()
            if remaining.total_seconds() > 0:
                hours = remaining.total_seconds() / 3600
                print(f"[KIS] 캐시된 토큰 로드 완료 (유효시간: {hours:.1f}시간 남음)")
            else:
                print(f"[KIS] 캐시된 토큰 로드 (만료됨, API 호출 시 재발급 시도)")

            return True

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"[KIS] 토큰 캐시 로드 실패: {e}")
            return False

    def _save_token_cache(self):
        """토큰 캐시 저장"""
        cache = {
            "token": {
                'access_token': self._access_token,
                'expires_at': self._token_expires_at.isoformat(),
                'issued_at': self._token_issued_at.isoformat(),
            }
        }

        with open(self._token_cache_path, 'w') as f:
            json.dump(cache, f, indent=2)

    def _can_refresh_token(self) -> bool:
        """토큰 재발급 가능 여부 확인 (1일 1회 제한)"""
        if self._token_issued_at is None:
            return True

        # 마지막 발급으로부터 23시간이 지났는지 확인 (여유 1시간)
        time_since_issue = datetime.now() - self._token_issued_at
        return time_since_issue.total_seconds() >= 23 * 3600

    def _is_token_valid(self) -> bool:
        """토큰이 유효한지 확인 (만료 10분 전까지 유효)"""
        if not self._access_token or not self._token_expires_at:
            return False
        return datetime.now() < self._token_expires_at - timedelta(minutes=10)

    def get_access_token(self, force_refresh: bool = False) -> str:
        """OAuth 액세스 토큰 반환

        Args:
            force_refresh: 강제 갱신 (주의: 1일 1회 제한)

        Returns:
            액세스 토큰

        Raises:
            TokenRefreshLimitError: 1일 1회 발급 제한 초과 시
        """
        # 캐시된 토큰이 유효하면 그대로 사용
        if not force_refresh and self._is_token_valid():
            return self._access_token

        # 캐시된 토큰이 있지만 만료된 경우
        if self._access_token and not force_refresh:
            print(f"[KIS] 토큰이 만료되었습니다. 캐시된 토큰으로 API 호출을 시도합니다.")
            return self._access_token

        # 토큰 재발급 필요
        return self._refresh_token()

    def _refresh_token(self) -> str:
        """토큰 재발급

        Raises:
            TokenRefreshLimitError: 1일 1회 발급 제한 초과 시
        """
        # 1일 1회 제한 확인
        if not self._can_refresh_token():
            remaining = timedelta(hours=23) - (datetime.now() - self._token_issued_at)
            hours = remaining.total_seconds() / 3600
            raise TokenRefreshLimitError(
                f"토큰 재발급은 1일 1회로 제한됩니다. "
                f"약 {hours:.1f}시간 후에 다시 시도하세요. "
                f"(마지막 발급: {self._token_issued_at.strftime('%Y-%m-%d %H:%M:%S')})"
            )

        print(f"[KIS] 새 토큰 발급 중... (주의: 1일 1회 제한)")

        url = f"{self.base_url}/oauth2/tokenP"
        headers = {"Content-Type": "application/json; charset=utf-8"}
        body = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
        }

        # AppKey 일부 마스킹하여 출력 (디버깅용)
        masked_key = self.app_key[:4] + "****" + self.app_key[-4:] if self.app_key and len(self.app_key) > 8 else "NOT_SET"
        print(f"[KIS] AppKey (마스킹): {masked_key}")
        print(f"[KIS] Base URL: {self.base_url}")

        response = requests.post(url, headers=headers, json=body)

        # 403 오류 시 상세 응답 출력
        if response.status_code == 403:
            print(f"[실패] 403 Client Error: Forbidden for url: {url}")
            print(f"[실패] 응답 내용: {response.text}")
            print(f"[실패] 가능한 원인:")
            print(f"       1. AppKey/AppSecret이 잘못되었거나 실전투자용이 아님")
            print(f"       2. KIS Developers에서 API 서비스 미신청 또는 만료 (1년 유효)")
            print(f"       3. 모의투자 키를 실전투자 URL에 사용 중")
            print(f"[해결] KIS Developers (https://apiportal.koreainvestment.com)에서 확인하세요")

        response.raise_for_status()

        data = response.json()

        if 'access_token' not in data:
            raise Exception(f"토큰 발급 실패: {data}")

        self._access_token = data['access_token']
        self._token_issued_at = datetime.now()

        # 토큰 만료 시간 (보통 24시간)
        expires_in = int(data.get('expires_in', 86400))
        self._token_expires_at = self._token_issued_at + timedelta(seconds=expires_in)

        self._save_token_cache()

        print(f"[KIS] 토큰 발급 완료 (유효기간: {expires_in // 3600}시간)")

        return self._access_token

    def _get_headers(self, tr_id: str, tr_cont: str = "") -> Dict[str, str]:
        """API 호출용 헤더 생성"""
        token = self.get_access_token()

        return {
            "Content-Type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": tr_id,
            "tr_cont": tr_cont,
            "custtype": "P",  # 개인
        }

    def request(
        self,
        method: str,
        path: str,
        tr_id: str,
        params: Dict[str, Any] = None,
        body: Dict[str, Any] = None,
        tr_cont: str = "",
        _retry: bool = True,
    ) -> Dict[str, Any]:
        """API 요청 실행

        토큰 만료로 401 에러 발생 시 자동으로 토큰 재발급 후 재시도합니다.
        """
        url = f"{self.base_url}{path}"
        headers = self._get_headers(tr_id, tr_cont)

        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params)
            else:
                response = requests.post(url, headers=headers, json=body)

            # 401 Unauthorized: 토큰 만료
            if response.status_code == 401 and _retry:
                print(f"[KIS] 토큰이 유효하지 않습니다. 재발급 시도...")
                self._refresh_token()
                # 재시도 (재귀 방지를 위해 _retry=False)
                return self.request(method, path, tr_id, params, body, tr_cont, _retry=False)

            response.raise_for_status()
            data = response.json()

            # 응답 본문에서 토큰 만료 확인 (HTTP 200이지만 rt_cd가 실패인 경우)
            if _retry and data.get("rt_cd") != "0":
                msg = data.get("msg1", "")
                if "만료" in msg or "token" in msg.lower():
                    print(f"[KIS] 토큰이 만료되었습니다 (msg: {msg}). 재발급 시도...")
                    self._refresh_token()
                    return self.request(method, path, tr_id, params, body, tr_cont, _retry=False)

            return data

        except requests.exceptions.HTTPError as e:
            # 에러 응답 본문 확인
            try:
                error_data = response.json()
                error_msg = error_data.get('msg1', str(e))
            except:
                error_msg = str(e)
            raise Exception(f"API 요청 실패: {error_msg}")

    def get_token_status(self) -> Dict[str, Any]:
        """현재 토큰 상태 조회"""
        status = {
            "has_token": self._access_token is not None,
            "is_valid": self._is_token_valid(),
            "can_refresh": self._can_refresh_token(),
        }

        if self._token_expires_at:
            remaining = self._token_expires_at - datetime.now()
            status["expires_at"] = self._token_expires_at.isoformat()
            status["remaining_hours"] = max(0, remaining.total_seconds() / 3600)

        if self._token_issued_at:
            status["issued_at"] = self._token_issued_at.isoformat()

        return status

    # ===== 개별 API 메서드 =====

    def get_stock_price(self, stock_code: str) -> Dict[str, Any]:
        """주식현재가 시세 조회"""
        path = "/uapi/domestic-stock/v1/quotations/inquire-price"
        tr_id = "FHKST01010100"
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": stock_code,
        }
        return self.request("GET", path, tr_id, params=params)

    def get_stock_asking_price(self, stock_code: str) -> Dict[str, Any]:
        """주식현재가 호가/예상체결 조회"""
        path = "/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn"
        tr_id = "FHKST01010200"
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": stock_code,
        }
        return self.request("GET", path, tr_id, params=params)

    def get_stock_investor(self, stock_code: str) -> Dict[str, Any]:
        """주식현재가 투자자 조회 (최근 30일)"""
        path = "/uapi/domestic-stock/v1/quotations/inquire-investor"
        tr_id = "FHKST01010900"
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": stock_code,
        }
        return self.request("GET", path, tr_id, params=params)

    def get_stock_member(self, stock_code: str) -> Dict[str, Any]:
        """주식현재가 회원사 조회"""
        path = "/uapi/domestic-stock/v1/quotations/inquire-member"
        tr_id = "FHKST01010600"
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": stock_code,
        }
        return self.request("GET", path, tr_id, params=params)

    def get_stock_daily_price(
        self,
        stock_code: str,
        period: str = "D",
        adj_price: bool = True,
    ) -> Dict[str, Any]:
        """국내주식기간별시세 조회 (일봉/주봉/월봉)"""
        path = "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
        tr_id = "FHKST03010100"

        end_date = datetime.now().strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=100)).strftime("%Y%m%d")

        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": stock_code,
            "FID_INPUT_DATE_1": start_date,
            "FID_INPUT_DATE_2": end_date,
            "FID_PERIOD_DIV_CODE": period,
            "FID_ORG_ADJ_PRC": "0" if adj_price else "1",
        }
        return self.request("GET", path, tr_id, params=params)

    def get_stock_daily_ccld(self, stock_code: str) -> Dict[str, Any]:
        """주식현재가 당일시간대별체결 조회"""
        path = "/uapi/domestic-stock/v1/quotations/inquire-time-itemconclusion"
        tr_id = "FHPST01060000"
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": stock_code,
            "FID_INPUT_HOUR_1": "",
        }
        return self.request("GET", path, tr_id, params=params)


def test_client():
    """클라이언트 테스트"""
    try:
        client = KISClient()
        print(f"\n[토큰 상태]")
        status = client.get_token_status()
        for k, v in status.items():
            print(f"  {k}: {v}")

        # 삼성전자 현재가 조회 테스트
        print(f"\n[삼성전자 현재가 테스트]")
        result = client.get_stock_price("005930")
        if result.get("rt_cd") == "0":
            output = result.get("output", {})
            print(f"  현재가: {output.get('stck_prpr', 'N/A')}원")
            print(f"  전일대비: {output.get('prdy_vrss', 'N/A')}원")
            print(f"  등락률: {output.get('prdy_ctrt', 'N/A')}%")
            print(f"  거래량: {output.get('acml_vol', 'N/A')}")
        else:
            print(f"  API 오류: {result.get('msg1', 'Unknown error')}")

    except TokenRefreshLimitError as e:
        print(f"\n[토큰 제한] {e}")
    except Exception as e:
        print(f"\n[ERROR] 테스트 실패: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_client()
