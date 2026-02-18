import { useState, Fragment } from "react"
import { TrendingUp, TrendingDown, ExternalLink, Newspaper, ChevronDown, ChevronUp, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice, formatVolume, formatChangeRate, formatTradingValue, getChangeBgColor, formatNetBuy, getNetBuyColor } from "@/lib/utils"
import type { Stock, StockHistory, StockNews, InvestorInfo, StockCriteria } from "@/types/stock"

/** 기준별 색상 및 라벨 정의 */
const CRITERIA_CONFIG = [
  { key: "high_breakout", dot: "bg-red-500", badge: "bg-red-100 text-red-700", label: "전고점 돌파", shortLabel: "전고점" },
  { key: "momentum_history", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700", label: "끼 보유", shortLabel: "끼" },
  { key: "resistance_breakout", dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700", label: "저항선 돌파", shortLabel: "저항선" },
  { key: "ma_alignment", dot: "bg-green-500", badge: "bg-green-100 text-green-700", label: "정배열", shortLabel: "정배열" },
  { key: "supply_demand", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700", label: "외국인/기관 수급", shortLabel: "수급" },
  { key: "program_trading", dot: "bg-lime-400", badge: "bg-lime-100 text-lime-700", label: "프로그램 매매", shortLabel: "프로그램" },
  { key: "top30_trading_value", dot: "bg-pink-500", badge: "bg-pink-100 text-pink-700", label: "거래대금 TOP30", shortLabel: "TOP30" },
] as const

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
  const [popupCriterion, setPopupCriterion] = useState<string | null>(null)
  const effectiveType = type === "neutral" ? (stock.change_rate >= 0 ? "rising" : "falling") : type
  const isRising = effectiveType === "rising"
  const TrendIcon = isRising ? TrendingUp : TrendingDown
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`
  const hasNews = news && news.news && news.news.length > 0
  const allMet = criteria?.all_met ?? false
  const showCriteria = isAdmin && criteria

  const handleDotClick = (e: React.MouseEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    setPopupCriterion(popupCriterion === key ? null : key)
  }

  return (
    <Card className={cn(
      "group hover:shadow-lg transition-all duration-200 hover:border-primary/30 bg-card",
      allMet && isAdmin && "ring-2 ring-yellow-400/70 shadow-[0_0_12px_rgba(234,179,8,0.3)] animate-[shimmer_3s_ease-in-out_infinite]"
    )}>
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
                          onClick={(e) => handleDotClick(e, key)}
                          className={cn(
                            "w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer sm:hidden",
                            "transition-transform hover:scale-125 shadow-sm",
                            dot
                          )}
                          title={label}
                        />
                        {is52w && (
                          <button
                            onClick={(e) => handleDotClick(e, key)}
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
                          onClick={(e) => handleDotClick(e, key)}
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
                  {popupCriterion && (() => {
                    const cfg = CRITERIA_CONFIG.find(c => c.key === popupCriterion)
                    const criterion = criteria[popupCriterion as keyof StockCriteria]
                    if (!cfg || typeof criterion === "boolean") return null
                    return (
                      <div className="absolute left-0 top-full mt-1 z-50 w-64 sm:w-72 bg-popover text-popover-foreground rounded-lg shadow-lg border border-border p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
                            <span className="text-xs font-semibold">{cfg.label}</span>
                          </div>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPopupCriterion(null) }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {criterion?.reason || "근거 없음"}
                        </p>
                      </div>
                    )
                  })()}
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
