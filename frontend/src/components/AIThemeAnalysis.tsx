import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ThemeAnalysis, MarketTheme, StockCriteria } from "@/types/stock"

/** 대장주 칩용 기준 도트 색상 (다른 컴포넌트와 동일 체계) */
const LEADER_CRITERIA = [
  { key: "high_breakout", dot: "bg-red-500", label: "전고점 돌파" },
  { key: "momentum_history", dot: "bg-orange-500", label: "끼 보유" },
  { key: "resistance_breakout", dot: "bg-yellow-400", label: "저항선 돌파" },
  { key: "ma_alignment", dot: "bg-teal-500", label: "정배열" },
  { key: "supply_demand", dot: "bg-blue-500", label: "외국인/기관 수급" },
  { key: "program_trading", dot: "bg-violet-500", label: "프로그램 매매" },
  { key: "top30_trading_value", dot: "bg-fuchsia-500", label: "거래대금 TOP30" },
] as const

interface AIThemeAnalysisProps {
  themeAnalysis: ThemeAnalysis
  showRefresh?: boolean
  criteriaData?: Record<string, StockCriteria>
  isAdmin?: boolean
}

function ThemeCard({ theme, index, criteriaData, isAdmin }: { theme: MarketTheme; index: number; criteriaData?: Record<string, StockCriteria>; isAdmin?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [popupStockCode, setPopupStockCode] = useState<string | null>(null)
  const showCriteria = isAdmin && criteriaData

  return (
    <div className="border rounded-lg p-3 sm:p-4 space-y-2.5">
      {/* 테마 헤더 */}
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs">
          테마 {index + 1}
        </Badge>
        <div className="min-w-0">
          <h4 className="font-semibold text-sm sm:text-base leading-tight">{theme.theme_name}</h4>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
            {theme.theme_description}
          </p>
        </div>
      </div>

      <hr className="border-border/50" />

      {/* 대장주 칩 */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs">대장주</Badge>
        {theme.leader_stocks.map((stock) => {
          const criteria = showCriteria ? criteriaData[stock.code] : undefined
          const allMet = criteria?.all_met
          const metDots = criteria ? LEADER_CRITERIA.filter(({ key }) => {
            const c = criteria[key as keyof StockCriteria]
            return typeof c !== "boolean" && c?.met
          }) : []
          const hasDots = metDots.length > 0

          return (
            <span
              key={stock.code}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md relative",
                "text-xs sm:text-sm font-medium",
                "transition-all duration-150",
                allMet
                  ? "bg-yellow-400/15 hover:bg-yellow-400/25 text-yellow-700 ring-1 ring-yellow-400/60 animate-[shimmer_3s_ease-in-out_infinite]"
                  : "bg-primary/10 hover:bg-primary/20 text-primary"
              )}
            >
              {hasDots && (
                <button
                  onClick={() => setPopupStockCode(popupStockCode === stock.code ? null : stock.code)}
                  className="inline-flex items-center gap-px mr-0.5 hover:opacity-70 transition-opacity"
                >
                  {metDots.map(({ key, dot }) => (
                    <span key={key} className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                  ))}
                </button>
              )}
              <a
                href={`https://m.stock.naver.com/domestic/stock/${stock.code}/total`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                {stock.name}
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
              {/* Criteria popup */}
              {popupStockCode === stock.code && criteria && (
                <div className="absolute left-0 top-full mt-1 z-50 w-64 sm:w-72 bg-popover text-popover-foreground rounded-lg shadow-lg border border-border p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold">{stock.name} 기준 충족</span>
                    <button
                      onClick={() => setPopupStockCode(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {metDots.map(({ key, dot, label }) => {
                      const c = criteria[key as keyof StockCriteria]
                      if (typeof c === "boolean") return null
                      return (
                        <div key={key} className="flex items-start gap-1.5">
                          <span className={cn("w-2 h-2 rounded-full shrink-0 mt-0.5", dot)} />
                          <div className="min-w-0">
                            <span className="text-[10px] font-semibold">{label}</span>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">{c?.reason || "근거 없음"}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </span>
          )
        })}
      </div>

      <hr className="border-border/50" />

      {/* 뉴스 근거 토글 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground",
          "hover:text-foreground transition-colors duration-150"
        )}
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? "뉴스 근거 접기" : "뉴스 근거 보기"}
      </button>

      {/* 뉴스 근거 상세 */}
      {expanded && (
        <div className="space-y-3">
          {theme.leader_stocks.map((stock) => (
            <div key={stock.code} className="pt-2 first:pt-0">
              <div className="mb-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-foreground/5 font-semibold text-xs sm:text-sm">
                  {stock.name}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed mb-2 pl-0.5">
                {stock.reason}
              </p>
              {stock.news_evidence.length > 0 && (
                <ul className="space-y-1 pl-0.5">
                  {stock.news_evidence.map((news, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] sm:text-xs">
                      <span className="text-muted-foreground/50 shrink-0 mt-px">{'•'}</span>
                      <a
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground hover:underline transition-colors break-words"
                      >
                        {news.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AIThemeAnalysis({ themeAnalysis, criteriaData, isAdmin }: AIThemeAnalysisProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!themeAnalysis?.themes?.length) {
    return null
  }

  const themeCount = themeAnalysis.themes.length

  return (
    <Card className="mb-4 sm:mb-6 overflow-hidden shadow-sm">
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* 헤더 (클릭으로 전체 토글) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
            <span className="font-semibold text-sm sm:text-base">AI 테마 분석</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              ({themeAnalysis.analysis_date} {themeAnalysis.analyzed_at.split(" ")[1]} 분석)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px] sm:text-xs">{themeCount}개 테마</Badge>
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </button>

        {/* 시장 요약 (항상 표시) */}
        <p className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
          {themeAnalysis.market_summary}
        </p>

        {/* 테마 카드 (접기/펼치기) */}
        {!collapsed && (
          <div className="space-y-2.5">
            {themeAnalysis.themes.map((theme, index) => (
              <ThemeCard key={index} theme={theme} index={index} criteriaData={criteriaData} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
