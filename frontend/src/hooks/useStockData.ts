import { useState, useEffect, useCallback, useRef } from "react"
import type { StockData } from "@/types/stock"

const DATA_URL = import.meta.env.BASE_URL + "data/latest.json"
const API_URL = import.meta.env.VITE_API_URL || ""

interface UseStockDataReturn {
  data: StockData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  refreshFromAPI: () => Promise<void>
  refreshElapsed: number
}

export function useStockData(): UseStockDataReturn {
  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshElapsed, setRefreshElapsed] = useState(0)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(DATA_URL + "?t=" + Date.now())
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const jsonData = await response.json()
      setData(jsonData)
    } catch (err) {
      console.error("Failed to fetch stock data:", err)
      setError("데이터를 불러오는데 실패했습니다.")

      // Try to load mock data for demo
      setData(getMockData())
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshFromAPI = useCallback(async () => {
    // API 서버 URL이 없으면 정적 데이터 다시 로드
    if (!API_URL) {
      await fetchData()
      return
    }

    setLoading(true)
    setError(null)
    setRefreshElapsed(0)

    // 서버 연결 가능 여부를 먼저 확인 (5초 타임아웃)
    try {
      const healthController = new AbortController()
      const healthTimeout = setTimeout(() => healthController.abort(), 5000)
      const healthRes = await fetch(API_URL + "/api/health", { signal: healthController.signal })
      clearTimeout(healthTimeout)
      if (!healthRes.ok) throw new Error("health check failed")
    } catch {
      // 서버 연결 불가 → 즉시 정적 데이터 재로드
      console.warn("API server unreachable, falling back to static data")
      await fetchData()
      setLoading(false)
      return
    }

    // 1초 간격 경과 시간 카운터
    refreshTimerRef.current = setInterval(() => {
      setRefreshElapsed((prev) => prev + 1)
    }, 1000)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000)

      const response = await fetch(API_URL + "/api/refresh", {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const jsonData = await response.json()

      if (jsonData.error) {
        throw new Error(jsonData.error)
      }

      setData(jsonData)
    } catch (err) {
      console.error("Failed to refresh from API:", err)
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요."
        : "실시간 데이터 수집에 실패했습니다. 기존 데이터를 다시 불러옵니다."
      setError(message)
      // 폴백: 기존 latest.json 다시 로드
      await fetchData()
    } finally {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      setRefreshElapsed(0)
      setLoading(false)
    }
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [])

  return { data, loading, error, refetch: fetchData, refreshFromAPI, refreshElapsed }
}

function getMockData(): StockData {
  return {
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    exchange: {
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      search_date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
      rates: [
        { currency: "USD", currency_name: "미국 달러", rate: 1450.00, ttb: 1435.50, tts: 1464.50, is_100: false },
        { currency: "JPY", currency_name: "일본 옌", rate: 950.00, ttb: 940.50, tts: 959.50, is_100: true },
        { currency: "EUR", currency_name: "유로", rate: 1580.00, ttb: 1564.20, tts: 1595.80, is_100: false },
      ],
    },
    rising: {
      kospi: [
        { rank: 1, code: "005930", name: "삼성전자", current_price: 87000, change_rate: 3.57, volume: 15000000 },
        { rank: 2, code: "000660", name: "SK하이닉스", current_price: 178000, change_rate: 5.32, volume: 8000000 },
        { rank: 3, code: "035420", name: "NAVER", current_price: 215000, change_rate: 2.87, volume: 3500000 },
      ],
      kosdaq: [
        { rank: 1, code: "086520", name: "에코프로", current_price: 95000, change_rate: 8.45, volume: 5000000 },
        { rank: 2, code: "247540", name: "에코프로비엠", current_price: 125000, change_rate: 6.78, volume: 4200000 },
      ],
    },
    falling: {
      kospi: [
        { rank: 1, code: "003670", name: "포스코퓨처엠", current_price: 245000, change_rate: -4.28, volume: 2100000 },
        { rank: 2, code: "006400", name: "삼성SDI", current_price: 385000, change_rate: -3.15, volume: 1800000 },
      ],
      kosdaq: [
        { rank: 1, code: "263750", name: "펄어비스", current_price: 42000, change_rate: -5.62, volume: 1500000 },
        { rank: 2, code: "293490", name: "카카오게임즈", current_price: 18500, change_rate: -4.12, volume: 2800000 },
      ],
    },
    volume: {
      kospi: [
        { rank: 1, code: "005930", name: "삼성전자", current_price: 87000, change_rate: 3.57, volume: 15000000, trading_value: 1305000000000 },
        { rank: 2, code: "000660", name: "SK하이닉스", current_price: 178000, change_rate: 5.32, volume: 8000000, trading_value: 1424000000000 },
        { rank: 3, code: "035420", name: "NAVER", current_price: 215000, change_rate: 2.87, volume: 3500000, trading_value: 752500000000 },
      ],
      kosdaq: [
        { rank: 1, code: "086520", name: "에코프로", current_price: 95000, change_rate: 8.45, volume: 5000000, trading_value: 475000000000 },
        { rank: 2, code: "247540", name: "에코프로비엠", current_price: 125000, change_rate: 6.78, volume: 4200000, trading_value: 525000000000 },
      ],
    },
    trading_value: {
      kospi: [
        { rank: 1, code: "000660", name: "SK하이닉스", current_price: 178000, change_rate: 5.32, volume: 8000000, trading_value: 1424000000000 },
        { rank: 2, code: "005930", name: "삼성전자", current_price: 87000, change_rate: 3.57, volume: 15000000, trading_value: 1305000000000 },
      ],
      kosdaq: [
        { rank: 1, code: "247540", name: "에코프로비엠", current_price: 125000, change_rate: 6.78, volume: 4200000, trading_value: 525000000000 },
        { rank: 2, code: "086520", name: "에코프로", current_price: 95000, change_rate: 8.45, volume: 5000000, trading_value: 475000000000 },
      ],
    },
    fluctuation: {
      kospi_up: [
        { rank: 1, code: "000660", name: "SK하이닉스", current_price: 178000, change_rate: 5.32, volume: 8000000 },
        { rank: 2, code: "005930", name: "삼성전자", current_price: 87000, change_rate: 3.57, volume: 15000000 },
      ],
      kospi_down: [
        { rank: 1, code: "003670", name: "포스코퓨처엠", current_price: 245000, change_rate: -4.28, volume: 2100000 },
      ],
      kosdaq_up: [
        { rank: 1, code: "086520", name: "에코프로", current_price: 95000, change_rate: 8.45, volume: 5000000 },
      ],
      kosdaq_down: [
        { rank: 1, code: "263750", name: "펄어비스", current_price: 42000, change_rate: -5.62, volume: 1500000 },
      ],
    },
    fluctuation_direct: {
      kospi_up: [
        { rank: 1, code: "005930", name: "삼성전자", current_price: 87000, change_rate: 3.57, volume: 15000000 },
      ],
      kospi_down: [
        { rank: 1, code: "006400", name: "삼성SDI", current_price: 385000, change_rate: -3.15, volume: 1800000 },
      ],
      kosdaq_up: [
        { rank: 1, code: "247540", name: "에코프로비엠", current_price: 125000, change_rate: 6.78, volume: 4200000 },
      ],
      kosdaq_down: [
        { rank: 1, code: "293490", name: "카카오게임즈", current_price: 18500, change_rate: -4.12, volume: 2800000 },
      ],
    },
    history: {
      "005930": {
        code: "005930",
        name: "삼성전자",
        changes: [
          { date: "2026-01-31", change_rate: 3.57 },
          { date: "2026-01-30", change_rate: 1.25 },
          { date: "2026-01-29", change_rate: -0.85 },
        ],
      },
    },
    news: {},
    investor_data: {
      "005930": { name: "삼성전자", foreign_net: 1500000, institution_net: -800000, individual_net: -700000 },
      "000660": { name: "SK하이닉스", foreign_net: 320000, institution_net: 150000, individual_net: -470000 },
      "086520": { name: "에코프로", foreign_net: -250000, institution_net: 180000, individual_net: 70000 },
    },
  }
}
