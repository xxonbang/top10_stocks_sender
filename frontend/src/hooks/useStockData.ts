import { useState, useEffect, useCallback } from "react"
import type { StockData } from "@/types/stock"

const DATA_URL = import.meta.env.BASE_URL + "data/latest.json"

interface UseStockDataReturn {
  data: StockData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useStockData(): UseStockDataReturn {
  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
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
  }
}
