import { useState, useEffect, useMemo, useCallback } from "react"
import { Header } from "@/components/Header"
import { ExchangeRate } from "@/components/ExchangeRate"
import { AIThemeAnalysis } from "@/components/AIThemeAnalysis"
import { StockList } from "@/components/StockList"
import { TabBar } from "@/components/TabBar"
import { HistoryModal } from "@/components/HistoryModal"
import { PaperTradingPage } from "@/components/PaperTradingPage"
import { AuthPage } from "@/components/AuthPage"
import { useStockData } from "@/hooks/useStockData"
import { useHistoryData } from "@/hooks/useHistoryData"
import { useAuth } from "@/hooks/useAuth"
import { Loader2, ArrowLeft, Calendar, Clock, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { HistoryEntry } from "@/types/history"
import type { TabType, FluctuationMode, CompositeMode, Stock } from "@/types/stock"

type PageType = "home" | "paper-trading"

// 로컬 스토리지 키
const COMPACT_MODE_KEY = "stock-dashboard-compact-mode"
const ACTIVE_TAB_KEY = "stock-dashboard-active-tab"
const FLUCTUATION_MODE_KEY = "stock-dashboard-fluctuation-mode"
const COMPOSITE_MODE_KEY = "stock-dashboard-composite-mode"

function App() {
  const { user, loading: authLoading, isAdmin, recordVisit, logActivity } = useAuth()
  const [currentPage, setCurrentPage] = useState<PageType>("home")

  // 페이지 전환/접속 시 이력 기록
  useEffect(() => {
    recordVisit()
    logActivity("page_view", { page: currentPage })
  }, [currentPage, recordVisit, logActivity])
  const { data: currentData, loading, error, refreshFromAPI, refreshElapsed } = useStockData()
  const {
    groupedHistory,
    selectedData: historyData,
    selectedEntry,
    loading: historyLoading,
    error: historyError,
    fetchIndex,
    fetchHistoryData,
    clearSelection,
  } = useHistoryData()

  // 히스토리 모달 상태
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // 컴팩트 모드 상태 (로컬 스토리지에서 복원)
  const [compactMode, setCompactMode] = useState(() => {
    const saved = localStorage.getItem(COMPACT_MODE_KEY)
    return saved === "true"
  })

  // 탭 상태 (로컬 스토리지에서 복원)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY)
    return (saved as TabType) || "composite"
  })

  // 등락률 모드 상태 (로컬 스토리지에서 복원)
  const [fluctuationMode, setFluctuationMode] = useState<FluctuationMode>(() => {
    const saved = localStorage.getItem(FLUCTUATION_MODE_KEY)
    return (saved as FluctuationMode) || "calculated"
  })

  // 종합 탭 구성 방식
  const [compositeMode, setCompositeMode] = useState<CompositeMode>(() => {
    const saved = localStorage.getItem(COMPOSITE_MODE_KEY)
    if (saved === "all" || saved === "trading_volume" || saved === "trading_fluc" || saved === "volume_fluc") return saved
    return "trading_fluc"
  })

  // 컴팩트 모드 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem(COMPACT_MODE_KEY, String(compactMode))
  }, [compactMode])

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_KEY, activeTab)
  }, [activeTab])

  useEffect(() => {
    localStorage.setItem(FLUCTUATION_MODE_KEY, fluctuationMode)
  }, [fluctuationMode])

  useEffect(() => {
    localStorage.setItem(COMPOSITE_MODE_KEY, compositeMode)
  }, [compositeMode])

  // Scroll to top 버튼 상태
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const toggleCompactMode = () => {
    setCompactMode((prev) => !prev)
  }

  // 현재 데이터 or 히스토리 데이터 표시
  const displayData = historyData || currentData
  const isViewingHistory = !!historyData

  // 신규 JSON 여부 (volume 필드가 있으면 신규)
  const hasNewFields = !!displayData?.volume

  // 등락률 모드에 따른 활성 등락률 데이터
  const activeFluctuationData = useMemo(() => {
    if (!displayData) return null
    if (hasNewFields) {
      return fluctuationMode === "direct"
        ? displayData.fluctuation_direct || displayData.fluctuation
        : displayData.fluctuation
    }
    // 이전 JSON 폴백: rising/falling에서 등락률 데이터 합성
    return {
      kospi_up: displayData.rising.kospi,
      kospi_down: displayData.falling.kospi,
      kosdaq_up: displayData.rising.kosdaq,
      kosdaq_down: displayData.falling.kosdaq,
    }
  }, [displayData, fluctuationMode, hasNewFields])

  // 거래량 탭 폴백 데이터
  const volumeTabData = useMemo(() => {
    if (!displayData) return null
    if (hasNewFields) {
      return displayData.volume!
    }
    // 이전 JSON 폴백: rising+falling 합쳐서 거래량순 정렬
    const kospiAll = [...displayData.rising.kospi, ...displayData.falling.kospi]
      .sort((a, b) => b.volume - a.volume)
      .map((s, i) => ({ ...s, rank: i + 1 }))
    const kosdaqAll = [...displayData.rising.kosdaq, ...displayData.falling.kosdaq]
      .sort((a, b) => b.volume - a.volume)
      .map((s, i) => ({ ...s, rank: i + 1 }))
    return { kospi: kospiAll, kosdaq: kosdaqAll }
  }, [displayData, hasNewFields])

  // 거래대금 탭 폴백 데이터
  const tradingValueTabData = useMemo(() => {
    if (!displayData) return null
    if (hasNewFields) {
      return displayData.trading_value!
    }
    // 이전 JSON 폴백: rising+falling 합쳐서 거래대금(또는 거래량)순 정렬
    const kospiAll = [...displayData.rising.kospi, ...displayData.falling.kospi]
      .sort((a, b) => (b.trading_value || b.volume) - (a.trading_value || a.volume))
      .map((s, i) => ({ ...s, rank: i + 1 }))
    const kosdaqAll = [...displayData.rising.kosdaq, ...displayData.falling.kosdaq]
      .sort((a, b) => (b.trading_value || b.volume) - (a.trading_value || a.volume))
      .map((s, i) => ({ ...s, rank: i + 1 }))
    return { kospi: kospiAll, kosdaq: kosdaqAll }
  }, [displayData, hasNewFields])

  // 종합 탭: compositeMode에 따른 교집합
  const compositeData = useMemo(() => {
    if (!displayData) return null
    if (!hasNewFields) return null // 이전 JSON이면 null → 폴백

    // 등락률 Set (모든 모드에서 필수)
    const flucKospiAll = new Set([
      ...(activeFluctuationData?.kospi_up || []).map((s: Stock) => s.code),
      ...(activeFluctuationData?.kospi_down || []).map((s: Stock) => s.code),
    ])
    const flucKosdaqAll = new Set([
      ...(activeFluctuationData?.kosdaq_up || []).map((s: Stock) => s.code),
      ...(activeFluctuationData?.kosdaq_down || []).map((s: Stock) => s.code),
    ])

    // 거래량 Set (all 모드에서 교차 필터에 사용)
    const volKospiSet = new Set((displayData.volume?.kospi || []).map((s: Stock) => s.code))
    const volKosdaqSet = new Set((displayData.volume?.kosdaq || []).map((s: Stock) => s.code))

    // 기준 데이터 (순서 결정) 및 필터 조건
    let baseKospi: Stock[]
    let baseKosdaq: Stock[]
    let filterKospi: (s: Stock) => boolean
    let filterKosdaq: (s: Stock) => boolean

    if (compositeMode === "all") {
      // 거래대금 ∩ 거래량 ∩ 등락률 (거래대금 순서 기준)
      baseKospi = displayData.trading_value?.kospi || []
      baseKosdaq = displayData.trading_value?.kosdaq || []
      filterKospi = (s) => flucKospiAll.has(s.code) && volKospiSet.has(s.code)
      filterKosdaq = (s) => flucKosdaqAll.has(s.code) && volKosdaqSet.has(s.code)
    } else if (compositeMode === "trading_volume") {
      // 거래대금 ∩ 거래량 (등락률 필터 없음, 거래대금 순서 기준)
      baseKospi = displayData.trading_value?.kospi || []
      baseKosdaq = displayData.trading_value?.kosdaq || []
      filterKospi = (s) => volKospiSet.has(s.code)
      filterKosdaq = (s) => volKosdaqSet.has(s.code)
    } else if (compositeMode === "trading_fluc") {
      // 거래대금 ∩ 등락률 (거래대금 순서 기준)
      baseKospi = displayData.trading_value?.kospi || []
      baseKosdaq = displayData.trading_value?.kosdaq || []
      filterKospi = (s) => flucKospiAll.has(s.code)
      filterKosdaq = (s) => flucKosdaqAll.has(s.code)
    } else {
      // 거래량 ∩ 등락률 (거래량 순서 기준)
      baseKospi = displayData.volume?.kospi || []
      baseKosdaq = displayData.volume?.kosdaq || []
      filterKospi = (s) => flucKospiAll.has(s.code)
      filterKosdaq = (s) => flucKosdaqAll.has(s.code)
    }

    const kospiFiltered = baseKospi.filter(filterKospi)
    const kosdaqFiltered = baseKosdaq.filter(filterKosdaq)

    // 상승/하락 분리
    let rank = 0
    const kospiUp = kospiFiltered.filter((s: Stock) => s.change_rate > 0).map((s: Stock) => ({ ...s, rank: ++rank }))
    rank = 0
    const kospiDown = kospiFiltered.filter((s: Stock) => s.change_rate < 0).map((s: Stock) => ({ ...s, rank: ++rank }))
    rank = 0
    const kosdaqUp = kosdaqFiltered.filter((s: Stock) => s.change_rate > 0).map((s: Stock) => ({ ...s, rank: ++rank }))
    rank = 0
    const kosdaqDown = kosdaqFiltered.filter((s: Stock) => s.change_rate < 0).map((s: Stock) => ({ ...s, rank: ++rank }))

    return {
      rising: { kospi: kospiUp, kosdaq: kosdaqUp },
      falling: { kospi: kospiDown, kosdaq: kosdaqDown },
    }
  }, [displayData, activeFluctuationData, hasNewFields, compositeMode])

  // 종합 탭 타이틀 (교집합 조건 반영)
  const compositeTitle = useMemo(() => {
    if (compositeMode === "all") return "거래대금 + 거래량"
    if (compositeMode === "trading_volume") return "거래대금 + 거래량"
    if (compositeMode === "trading_fluc") return "거래대금"
    return "거래량"
  }, [compositeMode])

  // 탭 전환 핸들러 (활동 로그 포함)
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    logActivity("tab_switch", { tab })
  }, [logActivity])

  const handleFluctuationModeChange = useCallback((mode: FluctuationMode) => {
    setFluctuationMode(mode)
    logActivity("mode_change", { fluctuation_mode: mode })
  }, [logActivity])

  const handleCompositeModeChange = useCallback((mode: CompositeMode) => {
    setCompositeMode(mode)
    logActivity("mode_change", { composite_mode: mode })
  }, [logActivity])

  // 히스토리 버튼 클릭 핸들러
  const handleHistoryClick = async () => {
    await fetchIndex()
    setShowHistoryModal(true)
  }

  // 히스토리 항목 선택 핸들러
  const handleHistorySelect = async (entry: HistoryEntry) => {
    await fetchHistoryData(entry)
    setShowHistoryModal(false)
    logActivity("history_view", { date: entry.date })
  }

  // 실시간 데이터로 돌아가기
  const handleBackToLive = () => {
    clearSelection()
  }

  // 데이터 수동 새로고침 핸들러
  const handleRefresh = useCallback(() => {
    refreshFromAPI()
    logActivity("data_refresh")
  }, [refreshFromAPI, logActivity])

  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  if (loading && !currentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 요일 계산
  const getWeekday = (dateStr: string) => {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    const [year, month, day] = dateStr.split("-")
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return weekdays[date.getDay()]
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        timestamp={displayData?.timestamp}
        onRefresh={handleRefresh}
        loading={loading}
        compactMode={compactMode}
        onToggleCompact={toggleCompactMode}
        onHistoryClick={handleHistoryClick}
        isViewingHistory={isViewingHistory}
        refreshElapsed={refreshElapsed}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isAdmin={isAdmin}
      />

      {/* 모의투자 페이지 */}
      {currentPage === "paper-trading" && (
        <main className="container px-3 sm:px-4 py-4 sm:py-6">
          <PaperTradingPage />
        </main>
      )}

      {/* 메인 대시보드 */}
      {currentPage === "home" && <>
      {/* 히스토리 보기 중 배너 */}
      {isViewingHistory && selectedEntry && (
        <div className="sticky top-14 sm:top-16 z-40 bg-muted/80 border-b border-border backdrop-blur-sm">
          <div className="container px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-xs sm:text-sm font-medium">
                  {selectedEntry.date.replace(/-/g, ".")} ({getWeekday(selectedEntry.date)})
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-xs sm:text-sm font-medium">{selectedEntry.time}</span>
              </div>
              <span className="text-xs text-muted-foreground/70 hidden sm:inline">
                과거 데이터
              </span>
            </div>
            <button
              onClick={handleBackToLive}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
                "text-xs sm:text-sm font-medium",
                "bg-primary/10 hover:bg-primary/20",
                "text-primary",
                "transition-colors duration-150"
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">최신으로 돌아가기</span>
              <span className="sm:hidden">돌아가기</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className={cn("sticky z-40", isViewingHistory && selectedEntry ? "top-[88px] sm:top-[100px]" : "top-14 sm:top-16")}>
        <TabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          fluctuationMode={fluctuationMode}
          onFluctuationModeChange={handleFluctuationModeChange}
          compositeMode={compositeMode}
          onCompositeModeChange={handleCompositeModeChange}
        />
      </div>

      <main className="container px-3 sm:px-4 py-4 sm:py-6">
        {error && !isViewingHistory && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-warning/10 border border-warning/20 text-warning">
            <p className="text-xs sm:text-sm">{error} (이전 데이터를 표시합니다)</p>
          </div>
        )}

        {/* Exchange Rate - Top section */}
        {displayData?.exchange && <ExchangeRate exchange={displayData.exchange} />}

        {/* AI Theme Analysis */}
        {displayData?.theme_analysis && <AIThemeAnalysis themeAnalysis={displayData.theme_analysis} />}

        {/* Tab Content */}
        <div className="space-y-4 sm:space-y-6">
          {activeTab === "composite" && displayData && (
            <>
              {compositeData ? (
                <>
                  <StockList
                    title={`${compositeTitle} + 상승률 TOP`}
                    kospiStocks={compositeData.rising.kospi}
                    kosdaqStocks={compositeData.rising.kosdaq}
                    history={displayData.history}
                    news={displayData.news}
                    type="rising"
                    compactMode={compactMode}
                    showTradingValue={true}
                    investorData={displayData.investor_data}
                    investorEstimated={displayData?.investor_estimated}
                  />
                  <StockList
                    title={`${compositeTitle} + 하락률 TOP`}
                    kospiStocks={compositeData.falling.kospi}
                    kosdaqStocks={compositeData.falling.kosdaq}
                    history={displayData.history}
                    news={displayData.news}
                    type="falling"
                    compactMode={compactMode}
                    showTradingValue={true}
                    investorData={displayData.investor_data}
                    investorEstimated={displayData?.investor_estimated}
                  />
                </>
              ) : (
                <>
                  {/* 이전 JSON 폴백: 기존 rising/falling 그대로 사용 */}
                  <StockList
                    title={`${compositeTitle} + 상승률 TOP10`}
                    kospiStocks={displayData.rising.kospi}
                    kosdaqStocks={displayData.rising.kosdaq}
                    history={displayData.history}
                    news={displayData.news}
                    type="rising"
                    compactMode={compactMode}
                    showTradingValue={true}
                    investorData={displayData.investor_data}
                    investorEstimated={displayData?.investor_estimated}
                  />
                  <StockList
                    title={`${compositeTitle} + 하락률 TOP10`}
                    kospiStocks={displayData.falling.kospi}
                    kosdaqStocks={displayData.falling.kosdaq}
                    history={displayData.history}
                    news={displayData.news}
                    type="falling"
                    compactMode={compactMode}
                    showTradingValue={true}
                    investorData={displayData.investor_data}
                    investorEstimated={displayData?.investor_estimated}
                  />
                </>
              )}
            </>
          )}

          {activeTab === "trading_value" && displayData && tradingValueTabData && (
            <StockList
              title="거래대금 TOP20"
              kospiStocks={tradingValueTabData.kospi.slice(0, 20)}
              kosdaqStocks={tradingValueTabData.kosdaq.slice(0, 20)}
              history={displayData.history}
              news={displayData.news}
              type="neutral"
              compactMode={compactMode}
              showTradingValue={true}
              investorData={displayData.investor_data}
              investorEstimated={displayData?.investor_estimated}
            />
          )}

          {activeTab === "volume" && displayData && volumeTabData && (
            <StockList
              title="거래량 TOP20"
              kospiStocks={volumeTabData.kospi.slice(0, 20)}
              kosdaqStocks={volumeTabData.kosdaq.slice(0, 20)}
              history={displayData.history}
              news={displayData.news}
              type="neutral"
              compactMode={compactMode}
              showTradingValue={true}
              investorData={displayData.investor_data}
              investorEstimated={displayData?.investor_estimated}
            />
          )}

          {activeTab === "fluctuation" && displayData && activeFluctuationData && (
            <>
              <StockList
                title="등락률 상승 TOP20"
                kospiStocks={(activeFluctuationData.kospi_up || []).slice(0, 20)}
                kosdaqStocks={(activeFluctuationData.kosdaq_up || []).slice(0, 20)}
                history={displayData.history}
                news={displayData.news}
                type="rising"
                compactMode={compactMode}
                showTradingValue={true}
                investorData={displayData.investor_data}
                investorEstimated={displayData?.investor_estimated}
              />
              <StockList
                title="등락률 하락 TOP20"
                kospiStocks={(activeFluctuationData.kospi_down || []).slice(0, 20)}
                kosdaqStocks={(activeFluctuationData.kosdaq_down || []).slice(0, 20)}
                history={displayData.history}
                news={displayData.news}
                type="falling"
                compactMode={compactMode}
                showTradingValue={true}
                investorData={displayData.investor_data}
                investorEstimated={displayData?.investor_estimated}
              />
            </>
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

      </>}

      {/* History Modal */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        groupedHistory={groupedHistory}
        onSelect={handleHistorySelect}
        loading={historyLoading}
        error={historyError}
      />

      {/* Scroll to Top */}
      <button
        onClick={scrollToTop}
        aria-label="맨 위로 이동"
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "w-10 h-10 rounded-full",
          "bg-primary/20 text-primary-foreground/50",
          "backdrop-blur-sm",
          "flex items-center justify-center",
          "hover:bg-primary/40 hover:text-primary-foreground hover:scale-110 active:scale-95",
          "transition-all duration-200",
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none",
        )}
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  )
}

export default App
