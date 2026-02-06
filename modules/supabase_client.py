"""
Supabase 클라이언트 - API 키 및 토큰 관리
중앙 집중식 API 키/토큰 저장소로 Supabase를 사용합니다.
"""
import os
import json
from datetime import datetime
from typing import Optional, Dict, Any
from supabase import create_client, Client


class SupabaseCredentialManager:
    """Supabase에서 API 키와 토큰을 조회하고 관리하는 클래스"""

    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self._client: Optional[Client] = None

    def _get_client(self) -> Optional[Client]:
        """Supabase 클라이언트 반환 (지연 초기화)"""
        if self._client is None:
            if not self.url or not self.key:
                return None
            self._client = create_client(self.url, self.key)
        return self._client

    def is_available(self) -> bool:
        """Supabase 연결 가능 여부 확인"""
        return bool(self.url and self.key)

    def get_credentials(self, service_name: str) -> Optional[Dict[str, str]]:
        """특정 서비스의 API 키 조회

        Args:
            service_name: 서비스 이름 (예: 'kis')

        Returns:
            credential_type을 키로, credential_value를 값으로 하는 딕셔너리
            예: {'app_key': 'xxx', 'app_secret': 'yyy'}
        """
        client = self._get_client()
        if not client:
            return None

        try:
            response = client.table('api_credentials').select(
                'credential_type, credential_value'
            ).eq('service_name', service_name).eq('is_active', True).execute()

            if not response.data:
                return None

            result = {}
            for row in response.data:
                result[row['credential_type']] = row['credential_value']

            return result

        except Exception as e:
            print(f"[Supabase] 키 조회 실패: {e}")
            return None

    def get_kis_credentials(self) -> Optional[Dict[str, str]]:
        """KIS API 키 조회

        Returns:
            {'app_key': 'xxx', 'app_secret': 'yyy'} 또는 None
        """
        creds = self.get_credentials('kis')
        if not creds:
            return None

        # 필수 키 확인
        if 'app_key' not in creds or 'app_secret' not in creds:
            print("[Supabase] KIS API 키가 불완전합니다.")
            return None

        return {
            'app_key': creds['app_key'],
            'app_secret': creds['app_secret'],
        }

    def get_kis_token(self) -> Optional[Dict[str, Any]]:
        """KIS access_token 조회 (Supabase에서)

        Returns:
            {
                'access_token': 'xxx',
                'expires_at': '2026-01-31T23:15:47',
                'issued_at': '2026-01-30T23:15:47'
            } 또는 None
        """
        client = self._get_client()
        if not client:
            return None

        try:
            response = client.table('api_credentials').select(
                'credential_value, expires_at'
            ).eq('service_name', 'kis').eq(
                'credential_type', 'access_token'
            ).eq('is_active', True).execute()

            if not response.data:
                return None

            row = response.data[0]
            # JSON으로 저장된 토큰 정보 파싱
            token_data = json.loads(row['credential_value'])

            # DB expires_at 컬럼 값 우선 사용, 없으면 JSON 내부 값으로 폴백
            if row.get('expires_at'):
                token_data['expires_at'] = row['expires_at']

            return token_data

        except json.JSONDecodeError:
            print("[Supabase] KIS 토큰 JSON 파싱 실패")
            return None
        except Exception as e:
            print(f"[Supabase] KIS 토큰 조회 실패: {e}")
            return None

    def get_kis_valid_token(self) -> Optional[Dict[str, Any]]:
        """만료되지 않은 KIS access_token만 조회 (Supabase에서)

        expires_at > now() 조건으로 DB에서 유효한 토큰만 반환합니다.

        Returns:
            {
                'access_token': 'xxx',
                'expires_at': '2026-01-31T23:15:47',
                'issued_at': '2026-01-30T23:15:47'
            } 또는 None (만료되었거나 토큰이 없는 경우)
        """
        client = self._get_client()
        if not client:
            return None

        try:
            response = client.table('api_credentials').select(
                'credential_value, expires_at'
            ).eq('service_name', 'kis').eq(
                'credential_type', 'access_token'
            ).eq('is_active', True).gt(
                'expires_at', datetime.now().isoformat()
            ).execute()

            if not response.data:
                return None

            row = response.data[0]
            token_data = json.loads(row['credential_value'])

            if row.get('expires_at'):
                token_data['expires_at'] = row['expires_at']

            return token_data

        except json.JSONDecodeError:
            print("[Supabase] KIS 토큰 JSON 파싱 실패")
            return None
        except Exception as e:
            print(f"[Supabase] KIS 유효 토큰 조회 실패: {e}")
            return None

    def save_kis_token(
        self,
        access_token: str,
        expires_at: datetime,
        issued_at: datetime,
    ) -> bool:
        """KIS access_token을 Supabase에 저장 (upsert)

        Args:
            access_token: OAuth 액세스 토큰
            expires_at: 토큰 만료 시간
            issued_at: 토큰 발급 시간

        Returns:
            성공 여부
        """
        client = self._get_client()
        if not client:
            return False

        token_data = {
            'access_token': access_token,
            'expires_at': expires_at.isoformat(),
            'issued_at': issued_at.isoformat(),
        }

        try:
            # 기존 레코드가 있는지 확인
            existing = client.table('api_credentials').select('id').eq(
                'service_name', 'kis'
            ).eq('credential_type', 'access_token').execute()

            if existing.data:
                # 업데이트
                response = client.table('api_credentials').update({
                    'credential_value': json.dumps(token_data),
                    'updated_at': datetime.now().isoformat(),
                    'expires_at': expires_at.isoformat(),
                }).eq('service_name', 'kis').eq(
                    'credential_type', 'access_token'
                ).execute()
            else:
                # 새로 삽입
                response = client.table('api_credentials').insert({
                    'service_name': 'kis',
                    'credential_type': 'access_token',
                    'credential_value': json.dumps(token_data),
                    'expires_at': expires_at.isoformat(),
                    'environment': 'production',
                    'description': 'KIS OAuth Access Token (자동 갱신)',
                    'is_active': True,
                }).execute()

            print(f"[Supabase] KIS 토큰 저장 완료")
            return True

        except Exception as e:
            print(f"[Supabase] KIS 토큰 저장 실패: {e}")
            return False

    def update_credential(
        self,
        service_name: str,
        credential_type: str,
        credential_value: str,
    ) -> bool:
        """API 키 업데이트

        Args:
            service_name: 서비스 이름 (예: 'kis')
            credential_type: 키 유형 (예: 'app_key', 'app_secret')
            credential_value: 새 키 값

        Returns:
            성공 여부
        """
        client = self._get_client()
        if not client:
            return False

        try:
            response = client.table('api_credentials').update({
                'credential_value': credential_value,
                'updated_at': datetime.now().isoformat(),
            }).eq('service_name', service_name).eq(
                'credential_type', credential_type
            ).execute()

            return bool(response.data)

        except Exception as e:
            print(f"[Supabase] 키 업데이트 실패: {e}")
            return False


# 싱글톤 인스턴스
_manager: Optional[SupabaseCredentialManager] = None


def get_supabase_manager() -> SupabaseCredentialManager:
    """Supabase 매니저 싱글톤 인스턴스 반환"""
    global _manager
    if _manager is None:
        _manager = SupabaseCredentialManager()
    return _manager


def get_kis_credentials_from_supabase() -> Optional[Dict[str, str]]:
    """Supabase에서 KIS API 키 조회 (편의 함수)"""
    manager = get_supabase_manager()
    return manager.get_kis_credentials()


def get_kis_token_from_supabase() -> Optional[Dict[str, Any]]:
    """Supabase에서 KIS access_token 조회 (편의 함수)"""
    manager = get_supabase_manager()
    return manager.get_kis_token()


def get_kis_valid_token_from_supabase() -> Optional[Dict[str, Any]]:
    """Supabase에서 만료되지 않은 KIS access_token 조회 (편의 함수)"""
    manager = get_supabase_manager()
    return manager.get_kis_valid_token()


def save_kis_token_to_supabase(
    access_token: str,
    expires_at: datetime,
    issued_at: datetime,
) -> bool:
    """Supabase에 KIS access_token 저장 (편의 함수)"""
    manager = get_supabase_manager()
    return manager.save_kis_token(access_token, expires_at, issued_at)
