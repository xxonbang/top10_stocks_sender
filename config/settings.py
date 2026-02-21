"""
KIS API 및 텔레그램 설정
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 프로젝트 루트 경로
ROOT_DIR = Path(__file__).parent.parent

# .env 파일 로드
load_dotenv(ROOT_DIR / ".env")

# 한국투자증권 API 설정
# 주의: 순위분석 API는 모의투자에서 지원되지 않으므로 실전투자만 사용
KIS_APP_KEY = os.getenv("KIS_APP_KEY")
KIS_APP_SECRET = os.getenv("KIS_APP_SECRET")
KIS_ACCOUNT_NO = os.getenv("KIS_ACCOUNT_NO")  # 계좌번호 (XXXXXXXX-XX 형식)

# KIS API 엔드포인트 (실전투자 전용)
KIS_BASE_URL = "https://openapi.koreainvestment.com:9443"

# 텔레그램 설정
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("CHAT_ID")

# 네이버 검색 API 설정
# https://developers.naver.com 에서 애플리케이션 등록 후 발급
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

# Gemini AI 설정 (테마 분석용)
GEMINI_API_KEY_1 = os.getenv("GEMINI_API_KEY_01")
GEMINI_API_KEY_2 = os.getenv("GEMINI_API_KEY_02")
GEMINI_API_KEY_3 = os.getenv("GEMINI_API_KEY_03")
GEMINI_API_KEY_4 = os.getenv("GEMINI_API_KEY_04")
GEMINI_API_KEY_5 = os.getenv("GEMINI_API_KEY_05")

# Supabase 설정 (API 키 중앙 관리용)
# https://supabase.com/dashboard 에서 프로젝트 설정 확인
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
