import { useState } from "react"
import { TrendingUp, TrendingDown, ExternalLink, Newspaper, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice, formatVolume, formatChangeRate, getChangeBgColor } from "@/lib/utils"
import type { Stock, StockHistory, StockNews } from "@/types/stock"

interface StockCardProps {
  stock: Stock
  history?: StockHistory
  news?: StockNews
  type: "rising" | "falling"
}

export function StockCard({ stock, history, news, type }: StockCardProps) {
  const [isNewsExpanded, setIsNewsExpanded] = useState(false)
  const isRising = type === "rising"
  const TrendIcon = isRising ? TrendingUp : TrendingDown
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`
  const hasNews = news && news.news && news.news.length > 0

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary/30 bg-card">
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
            <span className="text-muted-foreground">
              거래량 <span className="font-medium text-foreground">{formatVolume(stock.volume)}</span>
            </span>

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
                {news.news.slice(0, 2).map((item, idx) => (
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
