import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StockCard } from "@/components/StockCard"
import { cn, formatPrice, formatChangeRate } from "@/lib/utils"
import type { Stock, StockHistory, StockNews } from "@/types/stock"

interface StockListProps {
  title: string
  kospiStocks: Stock[]
  kosdaqStocks: Stock[]
  history: Record<string, StockHistory>
  news: Record<string, StockNews>
  type: "rising" | "falling"
  compactMode?: boolean
}

// 컴팩트 모드용 간단한 종목 행
function CompactStockRow({ stock, type }: { stock: Stock; type: "rising" | "falling" }) {
  const isRising = type === "rising"
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`

  return (
    <a
      href={naverUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between py-2 px-2 hover:bg-muted/50 rounded-md transition-colors group"
    >
      {/* Left: Rank + Name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={cn(
          "w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full shrink-0",
          isRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
        )}>
          {stock.rank}
        </span>
        <span className="font-medium text-xs truncate">{stock.name}</span>
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
      </div>

      {/* Right: Price + Change */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium tabular-nums">{formatPrice(stock.current_price)}</span>
        <span className={cn(
          "text-[10px] font-semibold px-1.5 py-0.5 rounded",
          isRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
        )}>
          {formatChangeRate(stock.change_rate)}
        </span>
      </div>
    </a>
  )
}

// 컴팩트 모드용 마켓 섹션
function CompactMarketSection({
  market,
  stocks,
  type,
  bgColor
}: {
  market: string
  stocks: Stock[]
  type: "rising" | "falling"
  bgColor: string
}) {
  if (stocks.length === 0) {
    return (
      <div className="py-2">
        <div className="flex items-center gap-1.5 mb-1 px-2">
          <div className={cn("w-2 h-2 rounded-full", bgColor)} />
          <span className="font-semibold text-xs">{market}</span>
          <span className="text-[10px] text-muted-foreground">(0)</span>
        </div>
        <p className="text-muted-foreground text-[10px] text-center py-2">해당 종목 없음</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 px-2">
        <div className={cn("w-2 h-2 rounded-full", bgColor)} />
        <span className="font-semibold text-xs">{market}</span>
        <span className="text-[10px] text-muted-foreground">({stocks.length})</span>
      </div>
      <div className="divide-y divide-border/30">
        {stocks.map((stock) => (
          <CompactStockRow key={stock.code} stock={stock} type={type} />
        ))}
      </div>
    </div>
  )
}

export function StockList({ title, kospiStocks, kosdaqStocks, history, news, type, compactMode }: StockListProps) {
  const isRising = type === "rising"
  const Icon = isRising ? TrendingUp : TrendingDown

  // 컴팩트 모드
  if (compactMode) {
    return (
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className={cn(
          "py-2 sm:py-3",
          isRising
            ? "bg-gradient-to-r from-red-500/5 via-red-500/3 to-transparent"
            : "bg-gradient-to-r from-blue-500/5 via-blue-500/3 to-transparent"
        )}>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Icon className={cn("w-4 h-4", isRising ? "text-red-500" : "text-blue-500")} />
            <span className="truncate">{title}</span>
            <Badge variant={isRising ? "rising" : "falling"} className="ml-auto text-[9px] sm:text-[10px] shrink-0">
              {kospiStocks.length + kosdaqStocks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-3 space-y-2">
          <CompactMarketSection
            market="KOSPI"
            stocks={kospiStocks}
            type={type}
            bgColor="bg-blue-600"
          />
          <CompactMarketSection
            market="KOSDAQ"
            stocks={kosdaqStocks}
            type={type}
            bgColor="bg-green-600"
          />
        </CardContent>
      </Card>
    )
  }

  // 기본 모드 (상세 보기)
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
