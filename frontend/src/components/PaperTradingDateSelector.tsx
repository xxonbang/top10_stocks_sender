import { CheckSquare, Square, CheckCheck, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PaperTradingIndexEntry, PaperTradingData } from "@/types/stock"

interface PaperTradingDateSelectorProps {
  entries: PaperTradingIndexEntry[]
  selectedDates: Set<string>
  dailyData: Map<string, PaperTradingData>
  isStockExcluded: (date: string, code: string) => boolean
  onToggleDate: (date: string) => void
  onToggleAll: () => void
}

function getWeekday(dateStr: string) {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
  const [year, month, day] = dateStr.split("-")
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return weekdays[date.getDay()]
}

export function PaperTradingDateSelector({
  entries,
  selectedDates,
  dailyData,
  isStockExcluded,
  onToggleDate,
  onToggleAll,
}: PaperTradingDateSelectorProps) {
  const allSelected = entries.length > 0 && selectedDates.size === entries.length

  return (
    <div className="space-y-2">
      {/* 전체 선택/해제 */}
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground">날짜 선택</span>
        <button
          onClick={onToggleAll}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs",
            "transition-colors duration-150",
            "hover:bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          {allSelected ? "전체 해제" : "전체 선택"}
        </button>
      </div>

      {/* 날짜 리스트 */}
      {entries.length === 0 ? (
        <div className="text-xs sm:text-sm text-muted-foreground text-center py-4">
          아직 모의투자 데이터가 없습니다.
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => {
            const selected = selectedDates.has(entry.date)
            const data = dailyData.get(entry.date)
            // 제외된 종목을 반영한 활성 종목 기준 계산
            const activeStocks = data?.stocks.filter(s => !isStockExcluded(entry.date, s.code)) ?? []
            const profitCount = activeStocks.filter(s => s.profit_rate > 0).length
            const lossCount = activeStocks.filter(s => s.profit_rate < 0).length
            const flatCount = activeStocks.filter(s => s.profit_rate === 0).length
            const totalInvested = activeStocks.reduce((sum, s) => sum + s.buy_price, 0)
            const totalValue = activeStocks.reduce((sum, s) => sum + s.close_price, 0)
            const activeProfitRate = totalInvested > 0
              ? Math.round(((totalValue - totalInvested) / totalInvested) * 10000) / 100
              : 0
            const isProfit = activeProfitRate > 0
            const isLoss = activeProfitRate < 0
            const sign = activeProfitRate >= 0 ? "+" : ""

            return (
              <button
                key={entry.date}
                onClick={() => onToggleDate(entry.date)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg",
                  "text-xs sm:text-sm transition-all duration-150",
                  selected
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted/30 border border-transparent hover:bg-muted/60",
                )}
              >
                <div className="flex items-center gap-2">
                  {selected ? (
                    <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium">
                    {entry.date.replace(/-/g, ".")}
                    <span className="text-muted-foreground ml-1">({getWeekday(entry.date)})</span>
                  </span>
                  <span className="text-muted-foreground">
                    {activeStocks.length}종목
                  </span>
                  {data && (
                    <span className="flex items-center gap-1.5 text-[10px] sm:text-xs">
                      <span className="flex items-center gap-0.5 text-red-500">
                        <TrendingUp className="w-3 h-3" />{profitCount}
                      </span>
                      <span className="flex items-center gap-0.5 text-blue-500">
                        <TrendingDown className="w-3 h-3" />{lossCount}
                      </span>
                      {flatCount > 0 && (
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          <Minus className="w-3 h-3" />{flatCount}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "font-semibold tabular-nums",
                  isProfit && "text-red-600",
                  isLoss && "text-blue-600",
                  !isProfit && !isLoss && "text-muted-foreground",
                )}>
                  {sign}{activeProfitRate}%
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
