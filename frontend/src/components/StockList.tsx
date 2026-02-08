import { TrendingUp, TrendingDown, BarChart3, ExternalLink } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StockCard } from "@/components/StockCard"
import { cn, formatPrice, formatVolume, formatChangeRate, formatTradingValue, formatNetBuy, getNetBuyColor } from "@/lib/utils"
import type { Stock, StockHistory, StockNews, InvestorInfo } from "@/types/stock"

interface StockListProps {
  title: string
  kospiStocks: Stock[]
  kosdaqStocks: Stock[]
  history: Record<string, StockHistory>
  news: Record<string, StockNews>
  type: "rising" | "falling" | "neutral"
  compactMode?: boolean
  showTradingValue?: boolean
  investorData?: Record<string, InvestorInfo>
  investorEstimated?: boolean
}

// 컴팩트 모드 컬럼 헤더 (flex: sticky left + scrollable right)
function CompactHeader({ showTradingValue, hasInvestorData, investorEstimated }: { showTradingValue?: boolean; hasInvestorData?: boolean; investorEstimated?: boolean }) {
  return (
    <div className="flex items-center py-1.5 text-[9px] sm:text-[10px] text-muted-foreground font-medium border-b border-border/50">
      <div className="sticky left-0 z-10 bg-card flex items-center gap-2 shrink-0 w-28 sm:w-40 pl-2 pr-1">
        <span className="w-5 text-center shrink-0">#</span>
        <span>종목명</span>
      </div>
      <div className="flex items-center shrink-0 pr-2">
        <span className="text-right w-16 sm:w-20">현재가</span>
        {showTradingValue && <span className="text-right w-12 sm:w-16">거래대금</span>}
        <span className="text-right w-11 sm:w-14">거래량</span>
        {hasInvestorData && <span className="text-right w-12 sm:w-14">외국인{investorEstimated && <span className="text-[8px] text-amber-500 ml-0.5">추정</span>}</span>}
        {hasInvestorData && <span className="text-right w-12 sm:w-14">기관{investorEstimated && <span className="text-[8px] text-amber-500 ml-0.5">추정</span>}</span>}
        {hasInvestorData && <span className="text-right w-12 sm:w-14">{investorEstimated ? "" : "개인"}</span>}
        <span className="text-center w-14 sm:w-16">등락률</span>
      </div>
    </div>
  )
}

// 컴팩트 모드용 간단한 종목 행 (flex: sticky left + scrollable right)
function CompactStockRow({ stock, type, showTradingValue, investorInfo, hasInvestorData }: { stock: Stock; type: "rising" | "falling" | "neutral"; showTradingValue?: boolean; investorInfo?: InvestorInfo; hasInvestorData?: boolean }) {
  const effectiveRising = type === "neutral" ? stock.change_rate >= 0 : type === "rising"
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.code}/total`

  return (
    <a
      href={naverUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center py-2 hover:bg-muted/50 transition-colors group"
    >
      {/* Sticky left: Rank + Name */}
      <div className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 flex items-center gap-2 shrink-0 w-28 sm:w-40 pl-2 pr-1 transition-colors">
        <span className={cn(
          "w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full shrink-0",
          type === "neutral"
            ? "bg-amber-500/10 text-amber-600"
            : effectiveRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
        )}>
          {stock.rank}
        </span>
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-medium text-xs truncate">{stock.name}</span>
          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0 hidden sm:block" />
        </div>
      </div>

      {/* Scrollable right: Data columns */}
      <div className="flex items-center shrink-0 pr-2">
        <span className="text-xs font-medium tabular-nums text-right w-16 sm:w-20">
          {formatPrice(stock.current_price)}<span className="text-[9px] text-muted-foreground">원</span>
        </span>
        {showTradingValue && (
          <span className="text-[10px] text-muted-foreground tabular-nums text-right w-12 sm:w-16">
            {stock.trading_value ? formatTradingValue(stock.trading_value) : "-"}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums text-right w-11 sm:w-14">
          {formatVolume(stock.volume)}
        </span>
        {hasInvestorData && (
          <span className={cn("text-[10px] tabular-nums text-right w-12 sm:w-14", investorInfo ? getNetBuyColor(investorInfo.foreign_net) : "text-muted-foreground")}>
            {investorInfo ? formatNetBuy(investorInfo.foreign_net) : "-"}
          </span>
        )}
        {hasInvestorData && (
          <span className={cn("text-[10px] tabular-nums text-right w-12 sm:w-14", investorInfo ? getNetBuyColor(investorInfo.institution_net) : "text-muted-foreground")}>
            {investorInfo ? formatNetBuy(investorInfo.institution_net) : "-"}
          </span>
        )}
        {hasInvestorData && (
          <span className={cn("text-[10px] tabular-nums text-right w-12 sm:w-14", investorInfo?.individual_net != null ? getNetBuyColor(investorInfo.individual_net) : "text-muted-foreground")}>
            {investorInfo?.individual_net != null ? formatNetBuy(investorInfo.individual_net) : "-"}
          </span>
        )}
        <span className={cn(
          "text-[10px] font-semibold px-1.5 py-0.5 rounded text-right w-14 sm:w-16",
          effectiveRising ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
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
  bgColor,
  showHeader = false,
  showTradingValue,
  investorData,
  investorEstimated,
}: {
  market: string
  stocks: Stock[]
  type: "rising" | "falling" | "neutral"
  bgColor: string
  showHeader?: boolean
  showTradingValue?: boolean
  investorData?: Record<string, InvestorInfo>
  investorEstimated?: boolean
}) {
  const hasInvestorData = !!investorData && Object.keys(investorData).length > 0

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
      <div className="overflow-x-auto scrollbar-hide">
        {showHeader && <CompactHeader showTradingValue={showTradingValue} hasInvestorData={hasInvestorData} investorEstimated={investorEstimated} />}
        <div className="divide-y divide-border/30">
          {stocks.map((stock) => (
            <CompactStockRow key={stock.code} stock={stock} type={type} showTradingValue={showTradingValue} investorInfo={investorData?.[stock.code]} hasInvestorData={hasInvestorData} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function StockList({ title, kospiStocks, kosdaqStocks, history, news, type, compactMode, showTradingValue, investorData, investorEstimated }: StockListProps) {
  const isNeutral = type === "neutral"
  const isRising = type === "rising"
  const Icon = isNeutral ? BarChart3 : isRising ? TrendingUp : TrendingDown
  const iconColor = isNeutral ? "text-amber-500" : isRising ? "text-red-500" : "text-blue-500"
  const gradientFrom = isNeutral
    ? "from-amber-500/5 via-amber-500/3 to-transparent"
    : isRising
      ? "from-red-500/5 via-red-500/3 to-transparent"
      : "from-blue-500/5 via-blue-500/3 to-transparent"
  const badgeVariant = isNeutral ? "outline" : isRising ? "rising" : "falling"

  // 컴팩트 모드
  if (compactMode) {
    return (
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className={cn("py-2 sm:py-3", `bg-gradient-to-r ${gradientFrom}`)}>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Icon className={cn("w-4 h-4", iconColor)} />
            <span className="truncate">{title}</span>
            <Badge variant={badgeVariant as any} className="ml-auto text-[9px] sm:text-[10px] shrink-0">
              {kospiStocks.length + kosdaqStocks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-3 space-y-3">
          <CompactMarketSection
            market="KOSPI"
            stocks={kospiStocks}
            type={type}
            bgColor="bg-blue-600"
            showHeader={true}
            showTradingValue={showTradingValue}
            investorData={investorData}
            investorEstimated={investorEstimated}
          />
          <CompactMarketSection
            market="KOSDAQ"
            stocks={kosdaqStocks}
            type={type}
            bgColor="bg-green-600"
            showHeader={true}
            showTradingValue={showTradingValue}
            investorData={investorData}
            investorEstimated={investorEstimated}
          />
        </CardContent>
      </Card>
    )
  }

  // 기본 모드 (상세 보기)
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className={cn("py-3 sm:py-4", `bg-gradient-to-r ${gradientFrom}`)}>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
          <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", iconColor)} />
          <span className="truncate">{title}</span>
          <Badge variant={badgeVariant as any} className="ml-auto text-[10px] sm:text-xs shrink-0">
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
                  investorInfo={investorData?.[stock.code]}
                  investorEstimated={investorEstimated}
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
                  investorInfo={investorData?.[stock.code]}
                  investorEstimated={investorEstimated}
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
