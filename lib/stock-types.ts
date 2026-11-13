export type Direction = "up" | "down" | "flat"

export type Stock = {
  id: string
  symbol: string
  name: string
  price: number
  prevClose: number
  change: number
  changePercent: number
  direction: Direction
  open?: number | null
  high?: number | null
  low?: number | null
  fiftyTwoWHigh?: number | null
  fiftyTwoWLow?: number | null
  volume?: number | null
  avgVol?: number | null
  pe?: number | null
  mktCap?: number | null
  eps?: number | null
  dividendYield?: number | null
  exchange?: string | null
  currency?: string | null
  // Freshness and extended-hours data, straight from the quote
  marketState?: string | null
  asOf?: number | null
  timeZone?: string | null
  exchangeDelayMinutes?: number
  prePrice?: number | null
  preChange?: number | null
  preChangePercent?: number | null
  preTime?: number | null
  postPrice?: number | null
  postChange?: number | null
  postChangePercent?: number | null
  postTime?: number | null
}

export type ChartPoint = { t: number; price: number; volume: number | null }
export type ChartData = { points: ChartPoint[]; timeZone: string; previousClose: number | null; currency: string | null }
