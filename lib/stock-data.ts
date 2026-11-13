import type { ChartData, Stock } from "./stock-types"

export const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN", "TSLA", "BA", "DIS", "GE", "HD", "NKE", "SBUX"]

export type QuotesResult = { stocks: Stock[]; stale: boolean; fetchedAt: number }

/** Live quotes from the API route. Returns null when market data is unreachable — never invents prices. */
export async function fetchQuotes(symbols: string[]): Promise<QuotesResult | null> {
  if (!symbols.length) return { stocks: [], stale: false, fetchedAt: Date.now() }
  try {
    const res = await fetch(`/api/stocks?action=quotes&symbols=${encodeURIComponent(symbols.join(","))}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data.stocks)) return null
    return {
      stocks: data.stocks.map((s: Stock) => ({ ...s, id: s.symbol })),
      stale: !!data.stale,
      fetchedAt: data.fetchedAt ?? Date.now(),
    }
  } catch {
    return null
  }
}

/** Price history for a range. Returns null when unavailable — the UI shows an empty state, not a fake chart. */
export async function fetchChart(symbol: string, timeframe: string): Promise<ChartData | null> {
  try {
    const res = await fetch(`/api/stocks?action=chart&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`)
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data.points) ? data : null
  } catch {
    return null
  }
}
