"""
프론트엔드용 JSON 데이터 내보내기 모듈
"""
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Any

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))

# 프로젝트 루트 경로
ROOT_DIR = Path(__file__).parent.parent


def save_history_file(data: Dict[str, Any], history_dir: Path) -> str:
    """날짜_시간 형식으로 히스토리 파일 저장

    Args:
        data: 저장할 데이터
        history_dir: 히스토리 디렉토리 경로

    Returns:
        저장된 파일명
    """
    history_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(KST)
    filename = now.strftime("%Y-%m-%d_%H%M") + ".json"
    file_path = history_dir / filename

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return filename


def cleanup_old_history(history_dir: Path, days: int = 30) -> int:
    """30일 이상 된 히스토리 파일 삭제

    Args:
        history_dir: 히스토리 디렉토리 경로
        days: 보관 기간 (기본 30일)

    Returns:
        삭제된 파일 수
    """
    if not history_dir.exists():
        return 0

    cutoff_date = datetime.now(KST) - timedelta(days=days)
    deleted_count = 0

    for file_path in history_dir.glob("*.json"):
        try:
            # 파일명에서 날짜 추출 (YYYY-MM-DD_HHMM.json)
            date_str = file_path.stem[:10]  # YYYY-MM-DD
            file_date = datetime.strptime(date_str, "%Y-%m-%d")
            file_date = file_date.replace(tzinfo=KST)

            if file_date < cutoff_date:
                file_path.unlink()
                deleted_count += 1
        except (ValueError, IndexError):
            # 파일명 형식이 맞지 않으면 건너뜀
            continue

    return deleted_count


def update_history_index(output_dir: Path) -> None:
    """히스토리 인덱스 파일 갱신

    Args:
        output_dir: 데이터 출력 디렉토리 (history 상위 디렉토리)
    """
    history_dir = output_dir / "history"

    if not history_dir.exists():
        entries = []
    else:
        entries = []
        for file_path in sorted(history_dir.glob("*.json"), reverse=True):
            try:
                # 파일명에서 날짜/시간 추출 (YYYY-MM-DD_HHMM.json)
                filename = file_path.name
                date_str = file_path.stem[:10]  # YYYY-MM-DD
                time_str = file_path.stem[11:13] + ":" + file_path.stem[13:15]  # HH:MM

                entries.append({
                    "filename": filename,
                    "date": date_str,
                    "time": time_str,
                    "path": f"data/history/{filename}",
                })
            except (ValueError, IndexError):
                continue

    index_data = {
        "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
        "entries": entries,
    }

    index_path = output_dir / "history-index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)


def _strip_meta(data: Dict) -> Dict:
    """메타 필드(collected_at, category, exclude_etf) 제거하여 JSON 경량화"""
    if not data:
        return {}
    return {k: v for k, v in data.items() if k not in ("collected_at", "category", "exclude_etf")}


def export_for_frontend(
    rising_stocks: Dict[str, List[Dict[str, Any]]],
    falling_stocks: Dict[str, List[Dict[str, Any]]],
    history_data: Dict[str, Dict[str, Any]],
    news_data: Dict[str, Dict[str, Any]],
    exchange_data: Dict[str, Any] = None,
    output_dir: str = "frontend/public/data",
    save_history: bool = True,
    volume_data: Dict = None,
    trading_value_data: Dict = None,
    fluctuation_data: Dict = None,
    fluctuation_direct_data: Dict = None,
    investor_data: Dict = None,
    investor_estimated: bool = False,
    theme_analysis: Dict = None,
    criteria_data: Dict = None,
) -> str:
    """프론트엔드용 JSON 데이터 내보내기

    Args:
        rising_stocks: 상승 종목 {"kospi": [...], "kosdaq": [...]}
        falling_stocks: 하락 종목 {"kospi": [...], "kosdaq": [...]}
        history_data: 3일간 등락률 데이터
        news_data: 뉴스 데이터
        exchange_data: 환율 데이터
        output_dir: 출력 디렉토리
        save_history: 히스토리 파일 저장 여부 (기본 True)
        volume_data: 거래량 TOP30 데이터
        trading_value_data: 거래대금 TOP30 데이터
        fluctuation_data: 등락률 TOP30 (자체 계산) 데이터
        fluctuation_direct_data: 등락률 TOP30 (전용 API) 데이터

    Returns:
        저장된 파일 경로
    """
    output_path = ROOT_DIR / output_dir
    output_path.mkdir(parents=True, exist_ok=True)

    # 데이터 구조화
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
        "news": news_data,
        "investor_data": investor_data if investor_data else None,
        "investor_estimated": investor_estimated if investor_data else None,
        "theme_analysis": theme_analysis,
        "criteria_data": criteria_data if criteria_data else None,
    }

    # None 값 필드 제거
    data = {k: v for k, v in data.items() if v is not None}

    # JSON 파일 저장 (latest.json)
    file_path = output_path / "latest.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # 히스토리 파일 저장
    if save_history:
        history_dir = output_path / "history"
        save_history_file(data, history_dir)
        cleanup_old_history(history_dir, days=30)
        update_history_index(output_path)

    return str(file_path)
