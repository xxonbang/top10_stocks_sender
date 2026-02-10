import { TrendingUp, TrendingDown, Minus, Wallet, BarChart3 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface PaperTradingSummaryProps {
  summary: {
    totalDays: number
    totalStocks: number
    profitStocks: number
    lossStocks: number
    flatStocks: number
    totalInvested: number
    totalValue: number
    totalProfit: number
    totalProfitRate: number
  }
}

export function PaperTradingSummary({ summary }: PaperTradingSummaryProps) {
  const isProfit = summary.totalProfitRate > 0
  const isLoss = summary.totalProfitRate < 0
  const sign = summary.totalProfitRate >= 0 ? "+" : ""

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="p-3 sm:p-4">
        {/* 총 수익률 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="font-semibold text-sm sm:text-base">종합 수익률</span>
          </div>
          <div className={cn(
            "font-bold text-lg sm:text-2xl tabular-nums",
            isProfit && "text-red-600",
            isLoss && "text-blue-600",
          )}>
            {sign}{summary.totalProfitRate}%
          </div>
        </div>

        {/* 수익금 */}
        <div className={cn(
          "text-right text-xs sm:text-sm tabular-nums mb-3",
          isProfit && "text-red-500/80",
          isLoss && "text-blue-500/80",
          !isProfit && !isLoss && "text-muted-foreground",
        )}>
          {sign}{summary.totalProfit.toLocaleString()}원
        </div>

        <hr className="border-border/50 mb-3" />

        {/* 상세 지표 */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <div className="text-muted-foreground">투자금</div>
              <div className="font-medium tabular-nums">{summary.totalInvested.toLocaleString()}원</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <div className="text-muted-foreground">평가금</div>
              <div className="font-medium tabular-nums">{summary.totalValue.toLocaleString()}원</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <TrendingUp className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <div>
              <div className="text-muted-foreground">수익 종목</div>
              <div className="font-medium text-red-600 tabular-nums">{summary.profitStocks}개</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <TrendingDown className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <div>
              <div className="text-muted-foreground">손실 종목</div>
              <div className="font-medium text-blue-600 tabular-nums">{summary.lossStocks}개</div>
            </div>
          </div>
          {summary.flatStocks > 0 && (
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Minus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-muted-foreground">보합 종목</div>
                <div className="font-medium text-muted-foreground tabular-nums">{summary.flatStocks}개</div>
              </div>
            </div>
          )}
        </div>

        {/* 기간/종목 수 */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
          <span>{summary.totalDays}일간 데이터</span>
          <span>총 {summary.totalStocks}종목</span>
        </div>
      </CardContent>
    </Card>
  )
}
