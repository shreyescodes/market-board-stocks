export type Stock = {
  id: string
  symbol: string
  name: string
  price: number
  prevClose: number
  change: number
  changePercent: number
  direction: "up" | "down" | "flat"
  sparkline: number[]
  open?: number
  high?: number
  low?: number
  fiftyTwoWHigh?: number
  fiftyTwoWLow?: number
  volume?: number
  avgVol?: number
  pe?: number | null
  mktCap?: number | null
  beta?: number | null
  eps?: number | null
  dividendYield?: number | null
  exchange?: string | null
  currency?: string
}


