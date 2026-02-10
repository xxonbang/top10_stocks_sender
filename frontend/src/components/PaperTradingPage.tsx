import { useEffect, useState } from "react"
import { Loader2, LineChart, RotateCcw, CheckCheck, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PaperTradingStockCard } from "@/components/PaperTradingStockCard"
import { PaperTradingSummary } from "@/components/PaperTradingSummary"
import { PaperTradingDateSelector } from "@/components/PaperTradingDateSelector"
import { usePaperTradingData } from "@/hooks/usePaperTradingData"
import { cn } from "@/lib/utils"
import type { PaperTradingData } from "@/types/stock"

export function PaperTradingPage() {
  const {
    index,
    loading,
    error,
    selectedDates,
    dailyData,
    summary,
    fetchIndex,
    toggleDate,
    toggleAllDates,
    toggleStock,
    toggleAllStocks,
    isStockExcluded,
    excludedStocks,
    resetExcluded,
  } = usePaperTradingData()

  useEffect(() => {
    fetchIndex()
  }, [fetchIndex])

  if (loading && index.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">모의투자 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())

  const toggleCollapse = (date: string) => {
    setCollapsedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  // 선택된 날짜의 데이터를 날짜순으로 정렬
  const selectedDailyData: { date: string; data: PaperTradingData }[] = []
  for (const date of Array.from(selectedDates).sort((a, b) => b.localeCompare(a))) {
    const data = dailyData.get(date)
    if (data) {
      selectedDailyData.push({ date, data })
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <LineChart className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-base sm:text-lg">AI 대장주 모의투자</h2>
        <span className="text-[10px] sm:text-xs text-muted-foreground">
          (Gemini 선정 대장주 1주씩 매수 → 장마감 종가 매도)
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* 종합 요약 */}
      {selectedDailyData.length > 0 && (
        <PaperTradingSummary summary={summary} />
      )}

      {/* 날짜 선택 */}
      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <PaperTradingDateSelector
            entries={index}
            selectedDates={selectedDates}
            dailyData={dailyData}
            isStockExcluded={isStockExcluded}
            onToggleDate={toggleDate}
            onToggleAll={toggleAllDates}
          />
        </CardContent>
      </Card>

      {/* 일별 종목 카드 */}
      {selectedDailyData.map(({ date, data }) => {
        const collapsed = collapsedDates.has(date)
        return (
          <Card key={date} className="overflow-hidden shadow-sm">
            <CardContent className="p-3 sm:p-4 space-y-3">
              {/* 일별 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCollapse(date)}
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    {collapsed ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-semibold text-sm sm:text-base">
                      {date.replace(/-/g, ".")}
                    </span>
                  </button>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {data.stocks.length}종목
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!collapsed && (
                    <button
                      onClick={() => toggleAllStocks(date, data.stocks.map(s => s.code))}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md text-xs",
                        "transition-colors duration-150",
                        "hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {data.stocks.every(s => isStockExcluded(date, s.code)) ? "전체 선택" : "전체 해제"}
                    </button>
                  )}
                  <div className={cn(
                    "font-bold text-sm sm:text-base tabular-nums",
                    data.summary.total_profit_rate > 0 && "text-red-600",
                    data.summary.total_profit_rate < 0 && "text-blue-600",
                  )}>
                    {data.summary.total_profit_rate >= 0 ? "+" : ""}{data.summary.total_profit_rate}%
                  </div>
                </div>
              </div>

              {!collapsed && (
                <>
                  <hr className="border-border/50" />

                  {/* 종목 카드 그리드 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {data.stocks.map(stock => (
                      <PaperTradingStockCard
                        key={`${date}-${stock.code}`}
                        stock={stock}
                        date={date}
                        isExcluded={isStockExcluded(date, stock.code)}
                        onToggle={toggleStock}
                        morningTimestamp={data.morning_timestamp}
                      />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* 제외된 종목 초기화 */}
      {excludedStocks.size > 0 && (
        <div className="flex justify-center">
          <button
            onClick={resetExcluded}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
              "text-xs sm:text-sm text-muted-foreground",
              "hover:bg-muted transition-colors duration-150",
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            제외된 종목 {excludedStocks.size}개 초기화
          </button>
        </div>
      )}

      {/* 빈 상태 */}
      {index.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <LineChart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">아직 모의투자 데이터가 없습니다.</p>
          <p className="text-xs mt-1">매일 15:40에 자동으로 수집됩니다.</p>
        </div>
      )}
    </div>
  )
}
