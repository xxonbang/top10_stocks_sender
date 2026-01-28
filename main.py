"""
AI Vision Stock Signal Analyzer - 메인 실행 파일
"""
import asyncio
import shutil
from datetime import datetime
from pathlib import Path

from config.settings import CAPTURES_DIR, OUTPUT_DIR, ROOT_DIR
from modules.scraper import run_scraper
from modules.ai_engine import analyze_stocks
from modules.utils import get_today_capture_dir, save_json, generate_markdown_report


def cleanup_old_files(keep_today: bool = True):
    """이전 캡처 파일 및 출력 파일 정리"""
    today = datetime.now().strftime("%Y-%m-%d")
    cleaned_captures = 0
    cleaned_outputs = 0

    # 캡처 디렉토리 정리
    if CAPTURES_DIR.exists():
        for item in CAPTURES_DIR.iterdir():
            if item.is_dir():
                # 오늘 날짜 폴더는 유지 (옵션에 따라)
                if keep_today and item.name == today:
                    continue
                try:
                    shutil.rmtree(item)
                    cleaned_captures += 1
                except Exception as e:
                    print(f"  [WARN] 삭제 실패: {item} - {e}")

    # 출력 디렉토리 정리 (오래된 파일만)
    if OUTPUT_DIR.exists():
        for item in OUTPUT_DIR.iterdir():
            if item.is_file():
                # 오늘 날짜 파일은 유지
                if keep_today and today in item.name:
                    continue
                try:
                    item.unlink()
                    cleaned_outputs += 1
                except Exception as e:
                    print(f"  [WARN] 삭제 실패: {item} - {e}")

    return cleaned_captures, cleaned_outputs


async def main():
    """메인 파이프라인 실행"""
    print("=" * 60)
    print("  AI Vision Stock Signal Analyzer (AVSSA)")
    print(f"  실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Phase 0: 이전 파일 정리
    print("\n=== Phase 0: 이전 파일 정리 ===\n")
    cleaned_captures, cleaned_outputs = cleanup_old_files(keep_today=False)
    print(f"정리 완료: 캡처 폴더 {cleaned_captures}개, 출력 파일 {cleaned_outputs}개 삭제")

    # Phase 1 & 2: 종목 수집 및 스크린샷 캡처
    scrape_results = await run_scraper()

    # 캡처 디렉토리
    capture_dir = get_today_capture_dir(CAPTURES_DIR)

    # Phase 3: AI 분석
    analysis_results = analyze_stocks(scrape_results, capture_dir)

    # Phase 4: 결과 저장
    print("\n=== Phase 4: 결과 저장 ===\n")

    today = datetime.now().strftime("%Y-%m-%d")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # JSON 저장
    json_path = OUTPUT_DIR / f"analysis_{today}.json"
    output_data = {
        "date": today,
        "total_stocks": len(analysis_results),
        "results": analysis_results
    }
    save_json(output_data, json_path)
    print(f"JSON 저장: {json_path}")

    # results/latest.json에도 저장 (GitHub Pages용)
    results_dir = ROOT_DIR / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    latest_path = results_dir / "latest.json"
    save_json(output_data, latest_path)
    print(f"Latest 저장: {latest_path}")

    # 마크다운 리포트 저장
    md_path = OUTPUT_DIR / f"report_{today}.md"
    generate_markdown_report(analysis_results, md_path)
    print(f"리포트 저장: {md_path}")

    # 시그널 요약
    print("\n=== 시그널 요약 ===\n")
    signal_count = {}
    for r in analysis_results:
        signal = r.get("signal", "N/A")
        signal_count[signal] = signal_count.get(signal, 0) + 1

    for signal, count in sorted(signal_count.items()):
        print(f"  {signal}: {count}개")

    print("\n" + "=" * 60)
    print("  분석 완료!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
