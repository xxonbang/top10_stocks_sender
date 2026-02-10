import { ExternalLink, X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PaperTradingStock } from "@/types/stock"

interface PaperTradingStockCardProps {
  stock: PaperTradingStock
  date: string
  isExcluded: boolean
  onToggle: (date: string, code: string) => void
  morningTimestamp?: string
}

export function PaperTradingStockCard({ stock, date, isExcluded, onToggle, morningTimestamp }: PaperTradingStockCardProps) {
  const isProfit = stock.profit_rate > 0
  const isLoss = stock.profit_rate < 0

  const sign = stock.profit_rate >= 0 ? "+" : ""

  // "2026-02-10 09:39:06" → "09:39"
  const buyTime = morningTimestamp?.split(" ")[1]?.slice(0, 5) || ""

  return (
    <div
      className={cn(
        "border rounded-lg p-3 sm:p-4 transition-all duration-200",
        isExcluded && "opacity-40 bg-muted/30",
        !isExcluded && isProfit && "border-red-200 bg-red-50/30",
        !isExcluded && isLoss && "border-blue-200 bg-blue-50/30",
        !isExcluded && !isProfit && !isLoss && "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* 종목 정보 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <a
              href={`https://m.stock.naver.com/domestic/stock/${stock.code}/total`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sm sm:text-base hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              {stock.name}
              <ExternalLink className="w-3 h-3 opacity-40" />
            </a>
            <span className="text-[10px] sm:text-xs text-muted-foreground">({stock.code})</span>
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
            {stock.theme}
          </div>
        </div>

        {/* 수익률 + 토글 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className={cn(
              "font-bold text-sm sm:text-base tabular-nums",
              !isExcluded && isProfit && "text-red-600",
              !isExcluded && isLoss && "text-blue-600",
            )}>
              {sign}{stock.profit_rate}%
            </div>
            <div className={cn(
              "text-[10px] sm:text-xs tabular-nums",
              !isExcluded && isProfit && "text-red-500/70",
              !isExcluded && isLoss && "text-blue-500/70",
              (isExcluded || (!isProfit && !isLoss)) && "text-muted-foreground",
            )}>
              {sign}{stock.profit_amount.toLocaleString()}원
            </div>
          </div>

          <button
            onClick={() => onToggle(date, stock.code)}
            className={cn(
              "flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-md",
              "transition-colors duration-150",
              isExcluded
                ? "bg-muted hover:bg-muted-foreground/20 text-muted-foreground"
                : "bg-muted/50 hover:bg-destructive/10 text-muted-foreground hover:text-destructive",
            )}
            title={isExcluded ? "포함" : "제외"}
          >
            {isExcluded ? (
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 가격 정보 */}
      <div className="mt-2 flex items-center gap-3 text-[11px] sm:text-xs text-muted-foreground">
        <span>매수{buyTime && <span className="text-muted-foreground/70">({buyTime})</span>} <span className="font-medium text-foreground">{stock.buy_price.toLocaleString()}</span></span>
        <span className="text-border">→</span>
        <span>종가 <span className="font-medium text-foreground">{stock.close_price.toLocaleString()}</span></span>
      </div>
    </div>
  )
}
