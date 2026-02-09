import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ThemeAnalysis, MarketTheme } from "@/types/stock"

interface AIThemeAnalysisProps {
  themeAnalysis: ThemeAnalysis
  showRefresh?: boolean
}

function ThemeCard({ theme, index }: { theme: MarketTheme; index: number }) {
  const [expanded, setExpanded] = useState(false)

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

      {/* 대장주 칩 */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {theme.leader_stocks.map((stock) => (
          <a
            key={stock.code}
            href={`https://finance.naver.com/item/main.naver?code=${stock.code}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md",
              "text-xs sm:text-sm font-medium",
              "bg-primary/10 hover:bg-primary/20 text-primary",
              "transition-colors duration-150"
            )}
          >
            {stock.name}
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
        ))}
      </div>

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
        <div className="space-y-3 pt-1">
          {theme.leader_stocks.map((stock) => (
            <div key={stock.code} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-xs sm:text-sm">{stock.name}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">— {stock.reason}</span>
              </div>
              {stock.news_evidence.length > 0 && (
                <ul className="space-y-0.5 pl-3">
                  {stock.news_evidence.map((news, i) => (
                    <li key={i} className="text-[10px] sm:text-xs">
                      <a
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground hover:underline transition-colors line-clamp-1"
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

export function AIThemeAnalysis({ themeAnalysis }: AIThemeAnalysisProps) {
  if (!themeAnalysis?.themes?.length) {
    return null
  }

  return (
    <Card className="mb-4 sm:mb-6 overflow-hidden shadow-sm">
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
            <span className="font-semibold text-sm sm:text-base">AI 테마 분석</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              ({themeAnalysis.analysis_date} {themeAnalysis.analyzed_at.split(" ")[1]} 분석)
            </span>
          </div>
        </div>

        {/* 시장 요약 */}
        <p className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
          {themeAnalysis.market_summary}
        </p>

        {/* 테마 카드 */}
        <div className="space-y-2.5">
          {themeAnalysis.themes.map((theme, index) => (
            <ThemeCard key={index} theme={theme} index={index} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
