import { useState, useCallback, useMemo } from "react"
import type { PaperTradingData, PaperTradingIndexEntry, PaperTradingStock } from "@/types/stock"

const INDEX_URL = import.meta.env.BASE_URL + "data/paper-trading-index.json"
const DATA_BASE_URL = import.meta.env.BASE_URL + "data/paper-trading/"

// 날짜별 제외 키: "2026-02-10:056080"
function stockKey(date: string, code: string) {
  return `${date}:${code}`
}

interface UsePaperTradingDataReturn {
  index: PaperTradingIndexEntry[]
  loading: boolean
  error: string | null
  selectedDates: Set<string>
  excludedStocks: Set<string>
  dailyData: Map<string, PaperTradingData>
  allStocks: PaperTradingStock[]
  activeStocks: PaperTradingStock[]
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
  fetchIndex: () => Promise<void>
  toggleDate: (date: string) => void
  toggleAllDates: () => void
  toggleStock: (date: string, code: string) => void
  toggleAllStocks: (date: string, codes: string[]) => void
  isStockExcluded: (date: string, code: string) => boolean
  resetExcluded: () => void
}

export function usePaperTradingData(): UsePaperTradingDataReturn {
  const [index, setIndex] = useState<PaperTradingIndexEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [excludedStocks, setExcludedStocks] = useState<Set<string>>(new Set())
  const [dailyData, setDailyData] = useState<Map<string, PaperTradingData>>(new Map())

  const fetchIndex = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(INDEX_URL + "?t=" + Date.now())
      if (!response.ok) {
        if (response.status === 404) {
          setIndex([])
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      const entries: PaperTradingIndexEntry[] = data.entries || []
      setIndex(entries)

      // 모든 날짜 자동 선택 + 데이터 로드
      const dates = new Set(entries.map((e: PaperTradingIndexEntry) => e.date))
      setSelectedDates(dates)

      // 모든 일별 데이터 병렬 로드
      const dataMap = new Map<string, PaperTradingData>()
      const fetchPromises = entries.map(async (entry: PaperTradingIndexEntry) => {
        try {
          const url = DATA_BASE_URL + entry.filename + "?t=" + Date.now()
          const res = await fetch(url)
          if (res.ok) {
            const json = await res.json()
            dataMap.set(entry.date, json)
          }
        } catch {
          // 개별 파일 로드 실패는 무시
        }
      })

      await Promise.all(fetchPromises)
      setDailyData(dataMap)
    } catch (err) {
      console.error("Failed to fetch paper trading index:", err)
      setError("모의투자 데이터를 불러오는데 실패했습니다.")
      setIndex([])
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleDate = useCallback((date: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }, [])

  const toggleAllDates = useCallback(() => {
    setSelectedDates(prev => {
      if (prev.size === index.length) {
        return new Set()
      }
      return new Set(index.map(e => e.date))
    })
  }, [index])

  const toggleStock = useCallback((date: string, code: string) => {
    setExcludedStocks(prev => {
      const key = stockKey(date, code)
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const toggleAllStocks = useCallback((date: string, codes: string[]) => {
    setExcludedStocks(prev => {
      const keys = codes.map(c => stockKey(date, c))
      const allExcluded = keys.every(k => prev.has(k))
      const next = new Set(prev)
      if (allExcluded) {
        keys.forEach(k => next.delete(k))
      } else {
        keys.forEach(k => next.add(k))
      }
      return next
    })
  }, [])

  const isStockExcluded = useCallback((date: string, code: string) => {
    return excludedStocks.has(stockKey(date, code))
  }, [excludedStocks])

  const resetExcluded = useCallback(() => {
    setExcludedStocks(new Set())
  }, [])

  // 선택된 날짜의 모든 종목
  const allStocks = useMemo(() => {
    const stocks: PaperTradingStock[] = []
    for (const date of selectedDates) {
      const data = dailyData.get(date)
      if (data) {
        stocks.push(...data.stocks)
      }
    }
    return stocks
  }, [selectedDates, dailyData])

  // 제외되지 않은 활성 종목 (날짜별 제외 반영)
  const activeStocks = useMemo(() => {
    const stocks: PaperTradingStock[] = []
    for (const date of selectedDates) {
      const data = dailyData.get(date)
      if (data) {
        for (const s of data.stocks) {
          if (!excludedStocks.has(stockKey(date, s.code))) {
            stocks.push(s)
          }
        }
      }
    }
    return stocks
  }, [selectedDates, dailyData, excludedStocks])

  // 종합 수익률 계산
  const summary = useMemo(() => {
    const totalStocks = activeStocks.length
    const profitStocks = activeStocks.filter(s => s.profit_rate > 0).length
    const lossStocks = activeStocks.filter(s => s.profit_rate < 0).length
    const flatStocks = activeStocks.filter(s => s.profit_rate === 0).length
    const totalInvested = activeStocks.reduce((sum, s) => sum + s.buy_price, 0)
    const totalValue = activeStocks.reduce((sum, s) => sum + s.close_price, 0)
    const totalProfit = totalValue - totalInvested
    const totalProfitRate = totalInvested > 0
      ? Math.round((totalProfit / totalInvested) * 10000) / 100
      : 0

    return {
      totalDays: selectedDates.size,
      totalStocks,
      profitStocks,
      lossStocks,
      flatStocks,
      totalInvested,
      totalValue,
      totalProfit,
      totalProfitRate,
    }
  }, [activeStocks, selectedDates])

  return {
    index,
    loading,
    error,
    selectedDates,
    excludedStocks,
    dailyData,
    allStocks,
    activeStocks,
    summary,
    fetchIndex,
    toggleDate,
    toggleAllDates,
    toggleStock,
    toggleAllStocks,
    isStockExcluded,
    resetExcluded,
  }
}
