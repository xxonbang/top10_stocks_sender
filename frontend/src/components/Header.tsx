import { useState, useEffect, useRef } from "react"
import { BarChart3, RefreshCw, LayoutGrid, List, Calendar, History } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeaderProps {
  timestamp?: string
  onRefresh?: () => void
  loading?: boolean
  compactMode?: boolean
  onToggleCompact?: () => void
  onHistoryClick?: () => void
  isViewingHistory?: boolean
  refreshElapsed?: number
}

export function Header({ timestamp, onRefresh, loading, compactMode, onToggleCompact, onHistoryClick, isViewingHistory, refreshElapsed }: HeaderProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipFading, setTooltipFading] = useState(false)
  const [toggleRipple, setToggleRipple] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false })
  const [refreshRipple, setRefreshRipple] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false })
  const [historyRipple, setHistoryRipple] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false })
  const [toggleFocusRing, setToggleFocusRing] = useState(false)
  const [refreshFocusRing, setRefreshFocusRing] = useState(false)
  const [historyFocusRing, setHistoryFocusRing] = useState(false)
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 툴팁 자동 숨김 (3초 후 fade-out)
  useEffect(() => {
    if (showTooltip && !tooltipFading) {
      // 기존 타이머 클리어
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
      // 3초 후 fade-out 시작
      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltipFading(true)
        // fade-out 애니메이션 후 완전히 숨김
        setTimeout(() => {
          setShowTooltip(false)
          setTooltipFading(false)
        }, 300)
      }, 3000)
    }
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
    }
  }, [showTooltip, tooltipFading])

  // 타임스탬프 클릭 핸들러
  const handleTimestampClick = () => {
    if (showTooltip) {
      // 이미 보이면 즉시 숨김
      setTooltipFading(true)
      setTimeout(() => {
        setShowTooltip(false)
        setTooltipFading(false)
      }, 300)
    } else {
      // 보이지 않으면 표시
      setShowTooltip(true)
      setTooltipFading(false)
    }
  }

  // Toggle 버튼 클릭 효과 (Ripple + 임시 Focus Ring)
  const handleToggleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setToggleRipple({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      show: true,
    })
    setTimeout(() => setToggleRipple(prev => ({ ...prev, show: false })), 500)

    // 임시 focus ring
    setToggleFocusRing(true)
    setTimeout(() => setToggleFocusRing(false), 400)

    onToggleCompact?.()
  }

  // Refresh 버튼 클릭 효과
  const handleRefreshClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) return

    const rect = e.currentTarget.getBoundingClientRect()
    setRefreshRipple({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      show: true,
    })
    setTimeout(() => setRefreshRipple(prev => ({ ...prev, show: false })), 500)

    // 임시 focus ring
    setRefreshFocusRing(true)
    setTimeout(() => setRefreshFocusRing(false), 400)

    onRefresh?.()
  }

  // History 버튼 클릭 효과
  const handleHistoryClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHistoryRipple({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      show: true,
    })
    setTimeout(() => setHistoryRipple(prev => ({ ...prev, show: false })), 500)

    // 임시 focus ring
    setHistoryFocusRing(true)
    setTimeout(() => setHistoryFocusRing(false), 400)

    onHistoryClick?.()
  }

  // 타임스탬프 파싱
  const parseTimestamp = (ts: string) => {
    if (!ts) return null
    const [date, time] = ts.split(" ")
    if (!date || !time) return null

    const [year, month, day] = date.split("-")
    const [hour, minute] = time.split(":")

    return {
      year,
      month,
      day,
      hour,
      minute,
      weekday: getWeekday(year, month, day),
      fullDate: `${year}.${month}.${day}`,
      fullTime: `${hour}:${minute}`,
      shortDate: `${month}.${day}`,
    }
  }

  const getWeekday = (year: string, month: string, day: string) => {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return weekdays[date.getDay()]
  }

  const getRelativeTime = (ts: string) => {
    if (!ts) return ""
    const [date, time] = ts.split(" ")
    if (!date || !time) return ""

    const [year, month, day] = date.split("-")
    const [hour, minute, second] = time.split(":")
    const timestamp = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second || "0")
    )

    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "방금 전"
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return null
  }

  const parsed = timestamp ? parseTimestamp(timestamp) : null
  const relativeTime = timestamp ? getRelativeTime(timestamp) : null

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-lg tracking-tight">
              <span className="sm:hidden">ThemeAnalyzer</span>
              <span className="hidden sm:inline">ThemeAnalyzer</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">거래량 + 등락률 교차 분석</p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Timestamp Badge - 클릭 가능 */}
          {parsed && (
            <div className="relative">
              <button
                onClick={handleTimestampClick}
                className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-2 rounded-full bg-gradient-to-r from-muted/80 to-muted/50 border border-border/50 shadow-sm cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-200 focus:outline-none"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-muted-foreground hidden sm:block" />
                    <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">
                      {parsed.fullDate}
                      <span className="text-muted-foreground ml-0.5">({parsed.weekday})</span>
                    </span>
                  </div>
                  <span className="w-px h-3 bg-border/70 hidden sm:block"></span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] sm:text-xs font-semibold tabular-nums">{parsed.fullTime}</span>
                  </div>
                </div>
              </button>

              {/* Tooltip - 3초 후 자동 fade-out */}
              {showTooltip && relativeTime && (
                <div
                  className={cn(
                    "absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5",
                    "bg-popover text-popover-foreground text-xs font-medium",
                    "rounded-md shadow-lg border border-border whitespace-nowrap z-50",
                    "transition-all duration-300",
                    tooltipFading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
                  )}
                >
                  <span className="text-green-500">●</span> {relativeTime} 업데이트
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-l border-t border-border rotate-45"></div>
                </div>
              )}
            </div>
          )}

          {/* History Button */}
          {onHistoryClick && (
            <button
              onClick={handleHistoryClick}
              className={cn(
                "relative overflow-hidden group",
                "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9",
                "rounded-lg",
                "bg-gradient-to-br from-secondary via-secondary to-secondary/80",
                "border border-border/50",
                "shadow-sm hover:shadow-md hover:shadow-primary/10",
                "transition-all duration-300 ease-out",
                "hover:scale-110 active:scale-95",
                "hover:border-primary/30",
                "focus:outline-none",
                isViewingHistory && "ring-2 ring-primary/50 border-primary/30 bg-primary/5"
              )}
              title="히스토리"
            >
              {/* 임시 Focus Ring */}
              <div
                className={cn(
                  "absolute inset-0 rounded-lg ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
                  "transition-opacity duration-300",
                  historyFocusRing ? "opacity-100" : "opacity-0"
                )}
              />

              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Icon */}
              <div className={cn(
                "relative z-10 transition-all duration-300",
                "group-hover:rotate-12 group-active:rotate-0"
              )}>
                <History className={cn(
                  "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110",
                  isViewingHistory && "text-primary"
                )} />
              </div>

              {/* Ripple effect */}
              {historyRipple.show && (
                <span
                  className="absolute rounded-full bg-primary/30 animate-ripple"
                  style={{
                    left: historyRipple.x,
                    top: historyRipple.y,
                    width: '4px',
                    height: '4px',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
            </button>
          )}

          {/* Compact Mode Toggle Button */}
          {onToggleCompact && (
            <button
              onClick={handleToggleClick}
              className={cn(
                "relative overflow-hidden group",
                "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9",
                "rounded-lg",
                "bg-gradient-to-br from-secondary via-secondary to-secondary/80",
                "border border-border/50",
                "shadow-sm hover:shadow-md hover:shadow-primary/10",
                "transition-all duration-300 ease-out",
                "hover:scale-110 active:scale-95",
                "hover:border-primary/30",
                "focus:outline-none"
              )}
              title={compactMode ? "상세 보기" : "간단 보기"}
            >
              {/* 임시 Focus Ring - 나타났다 사라짐 */}
              <div
                className={cn(
                  "absolute inset-0 rounded-lg ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
                  "transition-opacity duration-300",
                  toggleFocusRing ? "opacity-100" : "opacity-0"
                )}
              />

              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Icon */}
              <div className={cn(
                "relative z-10 transition-all duration-300",
                "group-hover:rotate-12 group-active:rotate-0"
              )}>
                {compactMode ? (
                  <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110" />
                ) : (
                  <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-110" />
                )}
              </div>

              {/* Ripple effect */}
              {toggleRipple.show && (
                <span
                  className="absolute rounded-full bg-primary/30 animate-ripple"
                  style={{
                    left: toggleRipple.x,
                    top: toggleRipple.y,
                    width: '4px',
                    height: '4px',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
            </button>
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={handleRefreshClick}
              disabled={loading}
              className={cn(
                "relative overflow-hidden group",
                "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9",
                "rounded-lg",
                "bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10",
                "text-primary",
                "border border-primary/20",
                "shadow-sm",
                "transition-all duration-300 ease-out",
                "hover:shadow-lg hover:shadow-primary/20",
                "hover:scale-110 hover:border-primary/40",
                "hover:from-primary/20 hover:via-primary/10 hover:to-primary/20",
                "active:scale-95",
                "focus:outline-none",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm"
              )}
              title={loading ? "갱신 중..." : "새로고침"}
            >
              {/* 임시 Focus Ring */}
              <div
                className={cn(
                  "absolute inset-0 rounded-lg ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
                  "transition-opacity duration-300",
                  refreshFocusRing ? "opacity-100" : "opacity-0"
                )}
              />

              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Shimmer effect */}
              <div className={cn(
                "absolute inset-0 -translate-x-full transition-transform duration-700 ease-out",
                "bg-gradient-to-r from-transparent via-white/20 to-transparent",
                !loading && "group-hover:translate-x-full"
              )} />

              {/* Icon */}
              <RefreshCw className={cn(
                "relative z-10 w-3.5 h-3.5 sm:w-4 sm:h-4",
                "transition-transform duration-500",
                loading ? "animate-spin" : "group-hover:rotate-180"
              )} />

              {/* Ripple effect */}
              {refreshRipple.show && !loading && (
                <span
                  className="absolute rounded-full bg-primary/40 animate-ripple"
                  style={{
                    left: refreshRipple.x,
                    top: refreshRipple.y,
                    width: '4px',
                    height: '4px',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
            </button>
          )}

          {/* Refresh Elapsed Time */}
          {loading && refreshElapsed != null && refreshElapsed > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums animate-pulse">
              <span className="hidden sm:inline">갱신 중 </span>
              {refreshElapsed}초
            </span>
          )}
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        @keyframes ripple {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(40);
            opacity: 0;
          }
        }
        .animate-ripple {
          animation: ripple 0.5s ease-out forwards;
        }
      `}</style>
    </header>
  )
}
