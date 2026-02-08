import { useRef, useEffect, useState, useCallback } from "react"
import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TabType, FluctuationMode, CompositeMode } from "@/types/stock"

interface TabBarProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  fluctuationMode: FluctuationMode
  onFluctuationModeChange: (mode: FluctuationMode) => void
  compositeMode: CompositeMode
  onCompositeModeChange: (mode: CompositeMode) => void
}

const tabs: { key: TabType; label: string; shortLabel: string }[] = [
  { key: "composite", label: "종합", shortLabel: "종합" },
  { key: "trading_value", label: "거래대금 TOP20", shortLabel: "거래대금" },
  { key: "volume", label: "거래량 TOP20", shortLabel: "거래량" },
  { key: "fluctuation", label: "등락률 TOP20", shortLabel: "등락률" },
]

const compositeModes: { key: CompositeMode; label: string; shortLabel: string }[] = [
  { key: "trading_fluc", label: "거래대금 + 등락률", shortLabel: "대금+등락률" },
  { key: "all", label: "거래대금 + 거래량 + 등락률", shortLabel: "대금+거래량+등락률" },
  { key: "trading_volume", label: "거래대금 + 거래량", shortLabel: "대금+거래량" },
  { key: "volume_fluc", label: "거래량 + 등락률", shortLabel: "거래량+등락률" },
]

// 세그먼트 버튼 공통 스타일
const segmentActive = "bg-background text-foreground font-semibold shadow-sm ring-1 ring-border/40"
const segmentInactive = "text-muted-foreground/70 font-medium hover:text-muted-foreground hover:bg-muted-foreground/5 active:scale-[0.97]"

export function TabBar({ activeTab, onTabChange, fluctuationMode, onFluctuationModeChange, compositeMode, onCompositeModeChange }: TabBarProps) {
  const showFlucToggle = activeTab === "fluctuation" || (activeTab === "composite" && compositeMode !== "trading_volume")
  const showCompositeToggle = activeTab === "composite"
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState({ width: 0, left: 0 })
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasAnyControl = showFlucToggle || showCompositeToggle

  // 슬라이딩 인디케이터 위치 계산
  useEffect(() => {
    const update = () => {
      const activeEl = tabRefs.current[activeTab]
      if (activeEl && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const tabRect = activeEl.getBoundingClientRect()
        setIndicator({
          width: tabRect.width,
          left: tabRect.left - containerRect.left,
        })
      }
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [activeTab])

  useEffect(() => {
    return () => {
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current)
    }
  }, [])

  const handleTooltipToggle = () => {
    if (showTooltip) {
      setShowTooltip(false)
    } else {
      setShowTooltip(true)
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current)
      tooltipTimeout.current = setTimeout(() => setShowTooltip(false), 5000)
    }
  }

  useEffect(() => {
    if (!showTooltip) return
    const handleClick = () => setShowTooltip(false)
    const id = setTimeout(() => document.addEventListener("click", handleClick), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener("click", handleClick)
    }
  }, [showTooltip])

  // 키보드 방향키 네비게이션
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, currentKey: TabType) => {
    const currentIndex = tabs.findIndex((t) => t.key === currentKey)
    let nextIndex = -1

    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    }

    if (nextIndex >= 0) {
      e.preventDefault()
      const nextKey = tabs[nextIndex].key
      onTabChange(nextKey)
      tabRefs.current[nextKey]?.focus()
    }
  }, [onTabChange])

  const isDirect = fluctuationMode === "direct"

  return (
    <div className="bg-card/80 backdrop-blur-sm border-b border-border/50 shadow-sm">
      <div className="container px-3 sm:px-4 py-2.5 sm:py-3">
        {/* 상단: 탭 */}
        <div className="flex items-center justify-between gap-3">
          <div
            ref={containerRef}
            role="tablist"
            aria-label="데이터 카테고리"
            className="relative inline-flex items-center rounded-xl bg-muted p-1"
          >
            {/* 슬라이딩 인디케이터 */}
            <div
              className="absolute top-1 bottom-1 rounded-lg bg-background shadow-sm ring-1 ring-border/30 transition-all duration-200 ease-out"
              style={{
                width: indicator.width,
                transform: `translateX(${indicator.left}px)`,
              }}
            />
            {tabs.map((tab) => (
              <button
                key={tab.key}
                ref={(el) => { tabRefs.current[tab.key] = el }}
                role="tab"
                aria-selected={activeTab === tab.key}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => onTabChange(tab.key)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.key)}
                className={cn(
                  "relative z-10 px-2.5 sm:px-4 py-2 sm:py-2 text-[11px] sm:text-sm font-medium rounded-lg",
                  "transition-all duration-200 whitespace-nowrap",
                  activeTab === tab.key
                    ? "text-foreground"
                    : [
                        "text-muted-foreground",
                        "hover:text-foreground",
                        "hover:bg-background/60",
                        "hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]",
                        "hover:scale-[1.03]",
                        "active:scale-[0.97]",
                        "active:bg-background/40",
                      ],
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                )}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 하단: 컨트롤 영역 (애니메이션 포함) */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            hasAnyControl ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 mt-2.5 pt-2 border-t border-border/30">
              {/* 리스트 구성 방식 토글 (종합 탭 전용) */}
              {showCompositeToggle && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] sm:text-xs text-muted-foreground/80 whitespace-nowrap shrink-0">
                    <span className="sm:hidden">구성</span>
                    <span className="hidden sm:inline">리스트 구성 방식</span>
                  </span>
                  <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
                    <div
                      role="radiogroup"
                      aria-label="리스트 구성 방식"
                      className="inline-flex items-center rounded-lg bg-muted p-0.5"
                    >
                      {compositeModes.map((mode) => (
                        <button
                          key={mode.key}
                          role="radio"
                          aria-checked={compositeMode === mode.key}
                          onClick={() => onCompositeModeChange(mode.key)}
                          className={cn(
                            "px-2 sm:px-3 py-1.5 sm:py-1.5 rounded-md text-[10px] sm:text-xs",
                            "transition-all duration-200 whitespace-nowrap",
                            compositeMode === mode.key ? segmentActive : segmentInactive,
                          )}
                        >
                          <span className="sm:hidden">{mode.shortLabel}</span>
                          <span className="hidden sm:inline">{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 등락률 데이터 소스 토글 */}
              {showFlucToggle && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] sm:text-xs text-muted-foreground/80 whitespace-nowrap">등락률 소스</span>
                  <div
                    role="radiogroup"
                    aria-label="등락률 데이터 소스"
                    className="inline-flex items-center rounded-lg bg-muted p-0.5"
                  >
                    <button
                      role="radio"
                      aria-checked={!isDirect}
                      onClick={() => onFluctuationModeChange("calculated")}
                      className={cn(
                        "px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-md text-[11px] sm:text-xs",
                        "transition-all duration-200 whitespace-nowrap",
                        !isDirect ? segmentActive : segmentInactive,
                      )}
                    >
                      자체 계산
                    </button>
                    <button
                      role="radio"
                      aria-checked={isDirect}
                      onClick={() => onFluctuationModeChange("direct")}
                      className={cn(
                        "px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-md text-[11px] sm:text-xs",
                        "transition-all duration-200 whitespace-nowrap",
                        isDirect ? segmentActive : segmentInactive,
                      )}
                    >
                      전용 API
                    </button>
                  </div>

                  {/* 도움말 */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTooltipToggle() }}
                      className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full",
                        "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted",
                        "transition-all duration-150",
                        showTooltip && "text-muted-foreground bg-muted"
                      )}
                      aria-label="등락률 데이터 소스 설명"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>

                    {showTooltip && (
                      <div
                        className={cn(
                          "absolute top-full mt-2 w-64 sm:w-72 p-3",
                          "bg-popover text-popover-foreground text-xs leading-relaxed",
                          "rounded-lg shadow-lg border border-border",
                          "z-50 animate-in fade-in-0 zoom-in-95 duration-150",
                          "right-0 sm:left-0 sm:right-auto",
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="font-semibold mb-1.5">등락률 데이터 소스</p>
                        <div className="space-y-1.5 text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">자체 계산</span>
                            {" "}&mdash; 거래량 API 데이터에서 등락률을 재정렬하여 산출합니다. 더 많은 종목을 포함합니다.
                          </p>
                          <p>
                            <span className="font-medium text-foreground">전용 API</span>
                            {" "}&mdash; KIS 등락률순위 전용 API(FHPST01700000)에서 직접 가져옵니다. 실시간 등락률에 특화되어 있습니다.
                          </p>
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground/70">
                          종합 탭의 교집합 결과에도 즉시 반영됩니다.
                        </p>
                        <div className="absolute -top-1.5 right-3 sm:left-3 sm:right-auto w-3 h-3 bg-popover border-l border-t border-border rotate-45" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
