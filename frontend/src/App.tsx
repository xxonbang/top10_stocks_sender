import { Header } from "@/components/Header"
import { StockList } from "@/components/StockList"
import { useStockData } from "@/hooks/useStockData"
import { Loader2 } from "lucide-react"

function App() {
  const { data, loading, error, refetch } = useStockData()

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        timestamp={data?.timestamp}
        onRefresh={refetch}
        loading={loading}
      />

      <main className="container px-3 sm:px-4 py-4 sm:py-6">
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-warning/10 border border-warning/20 text-warning">
            <p className="text-xs sm:text-sm">{error} (데모 데이터를 표시합니다)</p>
          </div>
        )}

        {/* Stock Lists - Full width with 2-column cards inside */}
        <div className="space-y-4 sm:space-y-6">
          {/* Rising Stocks */}
          {data && (
            <StockList
              title="거래량 + 상승률 TOP10"
              kospiStocks={data.rising.kospi}
              kosdaqStocks={data.rising.kosdaq}
              history={data.history}
              news={data.news}
              type="rising"
            />
          )}

          {/* Falling Stocks */}
          {data && (
            <StockList
              title="거래량 + 하락률 TOP10"
              kospiStocks={data.falling.kospi}
              kosdaqStocks={data.falling.kosdaq}
              history={data.history}
              news={data.news}
              type="falling"
            />
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t text-center text-xs sm:text-sm text-muted-foreground">
          <p>KIS API + Naver News API 기반 자동 분석</p>
          <p className="mt-1">
            매일 09:30, 21:00 KST 업데이트
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
