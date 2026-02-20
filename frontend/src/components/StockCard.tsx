import { useState, Fragment } from "react"
import { TrendingUp, TrendingDown, ExternalLink, Newspaper, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice, formatVolume, formatChangeRate, formatTradingValue, getChangeBgColor, formatNetBuy, getNetBuyColor } from "@/lib/utils"
import { CRITERIA_CONFIG } from "@/lib/criteria"
import { CriteriaPopup } from "@/components/CriteriaPopup"
import type { Stock, StockHistory, StockNews, InvestorInfo, StockCriteria } from "@/types/stock"

interface StockCardProps {
  stock: Stock
  history?: StockHistory
  news?: StockNews
  type: "rising" | "falling" | "neutral"
  investorInfo?: InvestorInfo
  investorEstimated?: boolean
  criteria?: StockCriteria
  isAdmin?: boolean
}

export function StockCard({ stock, history, news, type, investorInfo, investorEstimated, criteria, isAdmin }: StockCardProps) {
  const [isNewsExpanded, setIsNewsExpanded] = useState(false)
  const [showCriteriaPopup, setShowCriteriaPopup] = useState(false)
  const effectiveType = type === "neutral" ? (stock.change_rate >= 0 ? "rising" : "falling") : type
  const isRising = effectiveType === "rising"
  const TrendIcon = isRising ? TrendingUp : TrendingDown
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`
  const hasNews = news && news.news && news.news.length > 0
  const allMet = criteria?.all_met ?? false
  const shortWarning = isAdmin && criteria?.short_selling?.met
  const overheatWarning = isAdmin && criteria?.overheating?.met
  const overheatLevel = criteria?.overheating?.level
  const reverseWarning = isAdmin && criteria?.reverse_alignment?.met
  const showCriteria = isAdmin && criteria

  const handleDotClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowCriteriaPopup(true)
  }

  return (
    <Card className={cn(
      "group hover:shadow-lg transition-all duration-200 hover:border-primary/30 bg-card relative",
      allMet && isAdmin
        ? "ring-2 ring-yellow-400/70 shadow-[0_0_12px_rgba(234,179,8,0.3)] animate-[shimmer_3s_ease-in-out_infinite]"
        : shortWarning
          ? "ring-2 ring-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-[red-shimmer_2s_ease-in-out_infinite]"
          : overheatWarning
            ? cn(
                "ring-2 ring-orange-500/70 shadow-[0_0_12px_rgba(234,88,12,0.3)]",
                overheatLevel === "위험" ? "animate-[orange-shimmer_1.5s_ease-in-out_infinite]"
                  : overheatLevel === "경고" ? "animate-[orange-shimmer_2s_ease-in-out_infinite]"
                  : "animate-[orange-shimmer_3s_ease-in-out_infinite]"
              )
            : reverseWarning
              ? "ring-2 ring-indigo-500/70 shadow-[0_0_12px_rgba(99,102,241,0.3)] animate-[blue-shimmer_2s_ease-in-out_infinite]"
              : ""
    )}>
      {/* 경고 알림 뱃지 */}
      {isAdmin && (shortWarning || overheatWarning || reverseWarning) && (
        <div className="absolute -top-1.5 -right-1.5 z-10 flex gap-0.5">
          {shortWarning && <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white animate-pulse" title="공매도 경고" />}
          {overheatWarning && <span className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white animate-pulse" title="과열 경고" />}
          {reverseWarning && <span className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-white animate-pulse" title="역배열 경고" />}
        </div>
      )}
      <CardContent className="p-3 sm:p-4">
        {/* Header: Rank + Name + Price */}
        <div className="flex items-start justify-between gap-2">
          {/* Left: Rank + Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={cn(
              "flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-bold shrink-0",
              isRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
            )}>
              {stock.rank}
            </div>
            <div className="min-w-0 flex-1">
              <a
                href={naverUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sm sm:text-base text-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <span className="truncate">{stock.name}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:block" />
              </a>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">{stock.code}</p>

              {/* 기준 인디케이터 (admin만 표시) */}
              {showCriteria && (
                <div className="relative flex items-center gap-1 mt-0.5 flex-wrap">
                  {CRITERIA_CONFIG.map(({ key, dot, badge, label, shortLabel }) => {
                    const criterion = criteria[key as keyof StockCriteria]
                    if (typeof criterion === "boolean") return null
                    if (!criterion?.met) return null

                    const is52w = key === "high_breakout" && criterion?.is_52w_high

                    return (
                      <Fragment key={key}>
                        {/* 모바일: 도트 */}
                        <button
                          onClick={(e) => handleDotClick(e)}
                          className={cn(
                            "w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer sm:hidden",
                            "transition-transform hover:scale-125 shadow-sm",
                            dot
                          )}
                          title={label}
                        />
                        {is52w && (
                          <button
                            onClick={(e) => handleDotClick(e)}
                            className={cn(
                              "w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer sm:hidden",
                              "transition-transform hover:scale-125 shadow-sm",
                              dot
                            )}
                            title={`${label} (52주 신고가)`}
                          />
                        )}
                        {/* PC/태블릿: 뱃지 */}
                        <button
                          onClick={(e) => handleDotClick(e)}
                          className={cn(
                            "hidden sm:inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer",
                            "transition-opacity hover:opacity-80",
                            badge
                          )}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
                          {is52w ? "52주 신고가" : shortLabel}
                        </button>
                      </Fragment>
                    )
                  })}

                  {/* 팝업 */}
                  {showCriteriaPopup && (
                    <CriteriaPopup stockName={stock.name} criteria={criteria} onClose={() => setShowCriteriaPopup(false)} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Price + Change */}
          <div className="text-right shrink-0">
            <p className="font-bold text-sm sm:text-base tabular-nums">
              {formatPrice(stock.current_price)}
              <span className="text-muted-foreground text-[10px] sm:text-xs ml-0.5">원</span>
            </p>
            <Badge variant={isRising ? "rising" : "falling"} className="text-[10px] sm:text-xs px-1.5 sm:px-2">
              <TrendIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5" />
              {formatChangeRate(stock.change_rate)}
            </Badge>
          </div>
        </div>

        {/* Volume + History */}
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {stock.trading_value != null && (
              <span className="text-muted-foreground">
                거래대금 <span className="font-medium text-foreground">{formatTradingValue(stock.trading_value)}</span>
              </span>
            )}
            <span className="text-muted-foreground">
              거래량 <span className="font-medium text-foreground">{formatVolume(stock.volume)}</span>
            </span>

            {investorInfo && (
              <>
                <span className="text-muted-foreground">
                  외국인{investorEstimated && <span className="text-[8px] text-amber-500 ml-0.5">추정</span>} <span className={cn("font-medium", getNetBuyColor(investorInfo.foreign_net))}>{formatNetBuy(investorInfo.foreign_net)}</span>
                </span>
                <span className="text-muted-foreground">
                  기관{investorEstimated && <span className="text-[8px] text-amber-500 ml-0.5">추정</span>} <span className={cn("font-medium", getNetBuyColor(investorInfo.institution_net))}>{formatNetBuy(investorInfo.institution_net)}</span>
                </span>
                {investorInfo.individual_net != null && (
                  <span className="text-muted-foreground">
                    개인 <span className={cn("font-medium", getNetBuyColor(investorInfo.individual_net))}>{formatNetBuy(investorInfo.individual_net)}</span>
                  </span>
                )}
              </>
            )}

            {history && history.changes && history.changes.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {[...history.changes].reverse().slice(0, 3).map((change, idx) => {
                  const labels = ["D-2", "D-1", "D"]
                  return (
                    <span
                      key={idx}
                      className={cn(
                        "text-[9px] sm:text-[10px] px-1 py-0.5 rounded font-medium whitespace-nowrap",
                        getChangeBgColor(change.change_rate)
                      )}
                    >
                      {labels[idx]} {change.change_rate > 0 ? "+" : ""}{change.change_rate.toFixed(1)}%
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* News Section */}
        {hasNews && (
          <div className="mt-2 pt-2 border-t border-border/50">
            {/* Mobile: Expand/Collapse Button */}
            <button
              onClick={() => setIsNewsExpanded(!isNewsExpanded)}
              className="sm:hidden flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-1.5">
                <Newspaper className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">
                  관련 뉴스 ({news.news.length})
                </span>
              </div>
              {isNewsExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {/* Mobile: Collapsible News List */}
            {isNewsExpanded && (
              <ul className="sm:hidden mt-1.5 space-y-1">
                {news.news.slice(0, 3).map((item, idx) => (
                  <li key={idx}>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors line-clamp-2 block"
                      title={item.title}
                    >
                      • {item.title.replace(/<[^>]*>/g, '')}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {/* Desktop: Always visible */}
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Newspaper className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">관련 뉴스</span>
              </div>
              <ul className="space-y-1">
                {news.news.slice(0, 3).map((item, idx) => (
                  <li key={idx}>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] sm:text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1 block"
                      title={item.title}
                    >
                      • {item.title.replace(/<[^>]*>/g, '')}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
