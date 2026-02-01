import { TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StockCard } from "@/components/StockCard"
import type { Stock, StockHistory, StockNews } from "@/types/stock"

interface StockListProps {
  title: string
  kospiStocks: Stock[]
  kosdaqStocks: Stock[]
  history: Record<string, StockHistory>
  news: Record<string, StockNews>
  type: "rising" | "falling"
}

export function StockList({ title, kospiStocks, kosdaqStocks, history, news, type }: StockListProps) {
  const isRising = type === "rising"
  const Icon = isRising ? TrendingUp : TrendingDown

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className={`py-3 sm:py-4 ${isRising ? "bg-gradient-to-r from-red-500/5 via-red-500/3 to-transparent" : "bg-gradient-to-r from-blue-500/5 via-blue-500/3 to-transparent"}`}>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isRising ? "text-red-500" : "text-blue-500"}`} />
          <span className="truncate">{title}</span>
          <Badge variant={isRising ? "rising" : "falling"} className="ml-auto text-[10px] sm:text-xs shrink-0">
            {kospiStocks.length + kosdaqStocks.length} 종목
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* KOSPI */}
        <div>
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-600" />
            <h3 className="font-semibold text-sm sm:text-base md:text-lg">KOSPI</h3>
            <span className="text-xs sm:text-sm text-muted-foreground">({kospiStocks.length})</span>
          </div>
          {kospiStocks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
              {kospiStocks.map((stock) => (
                <StockCard
                  key={stock.code}
                  stock={stock}
                  history={history[stock.code]}
                  news={news[stock.code]}
                  type={type}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs sm:text-sm py-3 sm:py-4 text-center bg-muted/30 rounded-lg">해당 종목 없음</p>
          )}
        </div>

        {/* KOSDAQ */}
        <div>
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-600" />
            <h3 className="font-semibold text-sm sm:text-base md:text-lg">KOSDAQ</h3>
            <span className="text-xs sm:text-sm text-muted-foreground">({kosdaqStocks.length})</span>
          </div>
          {kosdaqStocks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
              {kosdaqStocks.map((stock) => (
                <StockCard
                  key={stock.code}
                  stock={stock}
                  history={history[stock.code]}
                  news={news[stock.code]}
                  type={type}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs sm:text-sm py-3 sm:py-4 text-center bg-muted/30 rounded-lg">해당 종목 없음</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
