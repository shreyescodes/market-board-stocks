import { NextResponse } from "next/server"
import YahooFinanceClass from "yahoo-finance2"

const yahooFinance = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] })
const NO_VALIDATION = { validateResult: false } as const

/* ───────────────────────────────────────────────────────────
   Small in-memory caches. Every open tab polls this route, so
   caching keeps upstream traffic to Yahoo low and predictable.
   ─────────────────────────────────────────────────────────── */
const QUOTE_TTL = 8_000 // fresh enough for a 10 s client poll
const QUOTE_STALE_LIMIT = 15 * 60_000 // serve last-known data (flagged stale) for up to 15 min
const CHART_TTL: Record<string, number> = {
  "1D": 60_000,
  "1W": 5 * 60_000,
  "1M": 30 * 60_000,
  "3M": 30 * 60_000,
  "1Y": 60 * 60_000,
  ALL: 6 * 60 * 60_000,
}

type Quote = Record<string, unknown> & { symbol: string }
const quoteCache = new Map<string, { at: number; quote: Quote }>()

type Point = { t: number; price: number; volume: number | null }
type ChartData = { points: Point[]; timeZone: string; previousClose: number | null; currency: string | null }
const chartCache = new Map<string, { at: number; data: ChartData }>()

const toMs = (d: unknown): number | null => {
  if (d instanceof Date) return d.getTime()
  if (typeof d === "number") return d < 1e12 ? d * 1000 : d
  if (typeof d === "string") {
    const n = Date.parse(d)
    return Number.isNaN(n) ? null : n
  }
  return null
}
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

function mapQuote(q: any): Quote | null {
  const price = num(q.regularMarketPrice)
  if (price == null) return null
  const prevClose = num(q.regularMarketPreviousClose) ?? price
  const change = num(q.regularMarketChange) ?? price - prevClose
  const changePercent = num(q.regularMarketChangePercent) ?? (prevClose ? (change / prevClose) * 100 : 0)
  return {
    symbol: q.symbol,
    name: q.longName || q.shortName || q.symbol, // longName reads naturally ("The Boeing Company")
    price,
    prevClose,
    change,
    changePercent,
    direction: change > 0.005 ? "up" : change < -0.005 ? "down" : "flat",
    open: num(q.regularMarketOpen),
    high: num(q.regularMarketDayHigh),
    low: num(q.regularMarketDayLow),
    fiftyTwoWHigh: num(q.fiftyTwoWeekHigh),
    fiftyTwoWLow: num(q.fiftyTwoWeekLow),
    volume: num(q.regularMarketVolume),
    avgVol: num(q.averageDailyVolume3Month),
    pe: num(q.trailingPE) ?? num(q.forwardPE),
    mktCap: num(q.marketCap),
    eps: num(q.epsTrailingTwelveMonths),
    dividendYield:
      num(q.dividendYield) ?? (num(q.trailingAnnualDividendYield) != null ? q.trailingAnnualDividendYield * 100 : null),
    exchange: q.fullExchangeName ?? q.exchange ?? null,
    currency: q.currency ?? null,
    // Freshness and session information
    marketState: q.marketState ?? null, // PRE | REGULAR | POST | POSTPOST | PREPRE | CLOSED
    asOf: toMs(q.regularMarketTime),
    timeZone: q.exchangeTimezoneName ?? null,
    // Yahoo's exchangeDataDelayedBy is a blanket per-exchange flag (often 15 even for fresh quotes),
    // so the client judges delay from the quote timestamp instead
    exchangeDelayMinutes: num(q.exchangeDataDelayedBy) ?? 0,
    prePrice: num(q.preMarketPrice),
    preChange: num(q.preMarketChange),
    preChangePercent: num(q.preMarketChangePercent),
    preTime: toMs(q.preMarketTime),
    postPrice: num(q.postMarketPrice),
    postChange: num(q.postMarketChange),
    postChangePercent: num(q.postMarketChangePercent),
    postTime: toMs(q.postMarketTime),
  }
}

/* One batched upstream request for every symbol whose cache entry is stale */
async function getQuotes(symbols: string[]) {
  const now = Date.now()
  const missing = symbols.filter((s) => {
    const hit = quoteCache.get(s)
    return !hit || now - hit.at > QUOTE_TTL
  })
  let upstreamFailed = false
  if (missing.length) {
    try {
      const res: any[] = (await yahooFinance.quote(missing, { return: "array" }, NO_VALIDATION)) as any
      for (const q of res ?? []) {
        const mapped = mapQuote(q)
        if (mapped) quoteCache.set(mapped.symbol, { at: now, quote: mapped })
      }
    } catch (e) {
      upstreamFailed = true
      console.warn("Yahoo quote request failed:", (e as Error).message)
    }
  }
  const stocks: Quote[] = []
  let stale = false
  let fetchedAt = now
  for (const s of symbols) {
    const hit = quoteCache.get(s)
    if (!hit || now - hit.at > QUOTE_STALE_LIMIT) continue
    if (now - hit.at > QUOTE_TTL) stale = true
    fetchedAt = Math.min(fetchedAt, hit.at)
    stocks.push(hit.quote)
  }
  return { stocks, stale: stale || (upstreamFailed && stocks.length > 0), fetchedAt, upstreamFailed }
}

/* Calendar date of a timestamp in the exchange's own time zone */
const dayKey = (t: number, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(t)

async function getChart(symbol: string, timeframe: string): Promise<ChartData | null> {
  const key = `${symbol}|${timeframe}`
  const ttl = CHART_TTL[timeframe] ?? 60_000
  const hit = chartCache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.data

  const DAY = 24 * 60 * 60 * 1000
  const cfg: Record<string, { back: number; interval: "5m" | "30m" | "1d" | "1mo" }> = {
    // 1D pulls a few days so the latest *session* is always present (weekends, holidays, pre-open)
    "1D": { back: 6 * DAY, interval: "5m" },
    "1W": { back: 7 * DAY, interval: "30m" },
    "1M": { back: 31 * DAY, interval: "1d" },
    "3M": { back: 92 * DAY, interval: "1d" },
    "1Y": { back: 366 * DAY, interval: "1d" },
    ALL: { back: 25 * 365 * DAY, interval: "1mo" },
  }
  const c = cfg[timeframe] ?? cfg["1M"]

  try {
    const chart: any = await yahooFinance.chart(
      symbol,
      // Regular-session bars only, so "1D" is the trading day rather than 4 AM–8 PM
      { period1: new Date(Date.now() - c.back), interval: c.interval, includePrePost: false },
      NO_VALIDATION,
    )
    const timeZone: string = chart?.meta?.exchangeTimezoneName ?? "America/New_York"
    let points: Point[] = (chart?.quotes ?? [])
      .map((q: any) => ({ t: toMs(q.date), price: num(q.close), volume: num(q.volume) }))
      .filter((p: any) => p.t != null && p.price != null) as Point[]

    let previousClose: number | null = num(chart?.meta?.chartPreviousClose)
    if (timeframe === "1D" && points.length) {
      // Keep only the most recent trading session; its previous close is the prior session's last price
      const lastDay = dayKey(points[points.length - 1].t, timeZone)
      const firstIdx = points.findIndex((p) => dayKey(p.t, timeZone) === lastDay)
      previousClose = firstIdx > 0 ? points[firstIdx - 1].price : previousClose
      points = points.slice(firstIdx)
    }

    const data: ChartData = { points, timeZone, previousClose, currency: chart?.meta?.currency ?? null }
    chartCache.set(key, { at: Date.now(), data })
    return data
  } catch (e) {
    console.warn(`Yahoo chart request failed for ${symbol} ${timeframe}:`, (e as Error).message)
    return hit?.data ?? null // last good copy if we have one
  }
}

function downsample(values: number[], target = 48) {
  if (values.length <= target) return values
  const step = (values.length - 1) / (target - 1)
  return Array.from({ length: target }, (_, i) => values[Math.round(i * step)])
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const symbolsParam = searchParams.get("symbols")
    const symbols = symbolsParam
      ? [...new Set(symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 50)
      : []

    if (action === "quotes") {
      if (!symbols.length) return NextResponse.json({ error: "Missing symbols parameter" }, { status: 400 })
      const result = await getQuotes(symbols)
      if (!result.stocks.length && result.upstreamFailed) {
        return NextResponse.json({ error: "Market data unavailable", stocks: [] }, { status: 503 })
      }
      return NextResponse.json(result)
    }

    if (action === "chart") {
      const symbol = searchParams.get("symbol")
      const timeframe = searchParams.get("timeframe") || "1M"
      if (!symbol) return NextResponse.json({ error: "Missing symbol parameter" }, { status: 400 })
      const data = await getChart(symbol.toUpperCase(), timeframe)
      if (!data) return NextResponse.json({ error: "Chart data unavailable" }, { status: 503 })
      return NextResponse.json(data)
    }

    // Real intraday sparklines: the latest session, downsampled
    if (action === "sparks") {
      if (!symbols.length) return NextResponse.json({ error: "Missing symbols parameter" }, { status: 400 })
      const entries = await Promise.all(
        symbols.map(async (s) => {
          const d = await getChart(s, "1D")
          return [s, d && d.points.length > 1 ? downsample(d.points.map((p) => p.price)) : null] as const
        }),
      )
      return NextResponse.json({ sparks: Object.fromEntries(entries.filter(([, v]) => v)) })
    }

    if (action === "search") {
      const query = searchParams.get("query")
      if (!query) return NextResponse.json({ error: "Missing query parameter" }, { status: 400 })
      try {
        const results: any = await yahooFinance.search(query, {}, NO_VALIDATION)
        const mappedResults = (results.quotes || [])
          .filter((q: any) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
          .map((q: any) => ({ symbol: q.symbol, name: q.shortname || q.longname || q.symbol, exchange: q.exchange || "" }))
          .slice(0, 5)
        return NextResponse.json({ results: mappedResults })
      } catch (e) {
        console.warn(`Ticker search failed for ${query}:`, (e as Error).message)
        return NextResponse.json({ error: "Search failed", results: [] }, { status: 503 })
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("API error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
