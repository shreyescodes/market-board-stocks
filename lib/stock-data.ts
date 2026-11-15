import type { ChartData, Stock } from "./stock-types"

export const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN", "TSLA", "BA", "DIS", "GE", "HD", "NKE", "SBUX"]

const MAX_PER_REQUEST = 50

export type QuotesResult = { stocks: Stock[]; stale: boolean; fetchedAt: number }

/** Live quotes from the API route. Returns null when market data is unreachable — never invents prices. */
export async function fetchQuotes(symbols: string[]): Promise<QuotesResult | null> {
  if (!symbols.length) return { stocks: [], stale: false, fetchedAt: Date.now() }
  // The route accepts up to 50 symbols per request
  if (symbols.length > MAX_PER_REQUEST) {
    const parts: string[][] = []
    for (let i = 0; i < symbols.length; i += MAX_PER_REQUEST) parts.push(symbols.slice(i, i + MAX_PER_REQUEST))
    const results = (await Promise.all(parts.map(fetchQuotes))).filter((r): r is QuotesResult => !!r)
    if (!results.length) return null
    return {
      stocks: results.flatMap((r) => r.stocks),
      stale: results.length < parts.length || results.some((r) => r.stale),
      fetchedAt: Math.min(...results.map((r) => r.fetchedAt)),
    }
  }
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

export type Movers = { gainers: Stock[]; losers: Stock[]; active: Stock[]; stale: boolean }

/** US market movers (Yahoo predefined screeners) */
export async function fetchMovers(): Promise<Movers | null> {
  try {
    const res = await fetch(`/api/stocks?action=movers`)
    if (!res.ok) return null
    const data = await res.json()
    const tag = (list: Stock[] = []) => list.map((s) => ({ ...s, id: s.symbol }))
    return { gainers: tag(data.gainers), losers: tag(data.losers), active: tag(data.active), stale: !!data.stale }
  } catch {
    return null
  }
}

export type Profile = { sector: string | null; industry: string | null; country: string | null; quoteType: string | null }

/** Sector / industry / country for each symbol (cached for a day on the server) */
export async function fetchProfiles(symbols: string[]): Promise<Record<string, Profile> | null> {
  if (!symbols.length) return {}
  try {
    const res = await fetch(`/api/stocks?action=profiles&symbols=${encodeURIComponent(symbols.join(","))}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.profiles ?? null
  } catch {
    return null
  }
}

export type Spark = { points: number[]; previousClose: number | null }

/** Downsampled latest-session prices for small inline charts (one request for many symbols) */
export async function fetchSparks(symbols: string[]): Promise<Record<string, Spark> | null> {
  if (!symbols.length) return {}
  try {
    const res = await fetch(`/api/stocks?action=sparks&symbols=${encodeURIComponent(symbols.slice(0, 40).join(","))}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.sparks ?? null
  } catch {
    return null
  }
}
