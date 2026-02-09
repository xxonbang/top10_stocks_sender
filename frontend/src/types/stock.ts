export interface Stock {
  rank: number
  code: string
  name: string
  current_price: number
  change_rate: number
  volume: number
  change_price?: number
  volume_rate?: number
  trading_value?: number
  market?: string
  is_etf?: boolean
  direction?: string
}

export interface HistoryChange {
  date: string
  change_rate: number
}

export interface StockHistory {
  code: string
  name: string
  changes: HistoryChange[]
}

export interface NewsItem {
  title: string
  link: string
  pubDate: string
}

export interface StockNews {
  name: string
  news: NewsItem[]
}

export interface ExchangeRate {
  currency: string
  currency_name: string
  rate: number
  ttb: number
  tts: number
  is_100: boolean
}

export interface ExchangeData {
  timestamp: string
  search_date: string
  rates: ExchangeRate[]
}

export interface FluctuationData {
  kospi_up: Stock[]
  kospi_down: Stock[]
  kosdaq_up: Stock[]
  kosdaq_down: Stock[]
}

export type TabType = "composite" | "trading_value" | "volume" | "fluctuation"
export type FluctuationMode = "calculated" | "direct"
export type CompositeMode = "all" | "trading_volume" | "trading_fluc" | "volume_fluc"

export interface ThemeNewsEvidence {
  title: string
  url: string
}

export interface ThemeLeaderStock {
  name: string
  code: string
  reason: string
  news_evidence: ThemeNewsEvidence[]
}

export interface MarketTheme {
  theme_name: string
  theme_description: string
  leader_stocks: ThemeLeaderStock[]
}

export interface ThemeAnalysis {
  analyzed_at: string
  analysis_date: string
  market_summary: string
  themes: MarketTheme[]
}

export interface InvestorInfo {
  name: string
  foreign_net: number
  institution_net: number
  individual_net?: number
}

export interface StockData {
  timestamp: string
  exchange: ExchangeData
  rising: {
    kospi: Stock[]
    kosdaq: Stock[]
  }
  falling: {
    kospi: Stock[]
    kosdaq: Stock[]
  }
  volume?: { kospi: Stock[]; kosdaq: Stock[] }
  trading_value?: { kospi: Stock[]; kosdaq: Stock[] }
  fluctuation?: FluctuationData
  fluctuation_direct?: FluctuationData
  history: Record<string, StockHistory>
  news: Record<string, StockNews>
  investor_data?: Record<string, InvestorInfo>
  investor_estimated?: boolean
  theme_analysis?: ThemeAnalysis
}
