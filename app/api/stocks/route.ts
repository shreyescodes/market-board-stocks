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

/* Market movers (US) from Yahoo's predefined screeners, cached for a minute */
const MOVER_LISTS = { gainers: "day_gainers", losers: "day_losers", active: "most_actives" } as const
const MOVERS_TTL = 60_000
let moversCache: { at: number; data: Record<string, Quote[]> } | null = null

async function getMovers() {
  if (moversCache && Date.now() - moversCache.at < MOVERS_TTL) return { data: moversCache.data, stale: false }
  try {
    const entries = await Promise.all(
      Object.entries(MOVER_LISTS).map(async ([key, scrIds]) => {
        const r = obj(await yahooFinance.screener({ scrIds, count: 10 }, undefined, NO_VALIDATION))
        return [key, list(r.quotes).map(mapQuote).filter((q): q is Quote => !!q)] as const
      }),
    )
    const data = Object.fromEntries(entries)
    moversCache = { at: Date.now(), data }
    return { data, stale: false }
  } catch (e) {
    console.warn("Yahoo screener request failed:", (e as Error).message)
    return moversCache ? { data: moversCache.data, stale: true } : null
  }
}

/* Company profile (sector, industry, country) — changes rarely, cached for a day */
const PROFILE_TTL = 24 * 60 * 60_000
type Profile = { sector: string | null; industry: string | null; country: string | null; quoteType: string | null }
const profileCache = new Map<string, { at: number; profile: Profile }>()

async function getProfile(symbol: string): Promise<Profile | null> {
  const hit = profileCache.get(symbol)
  if (hit && Date.now() - hit.at < PROFILE_TTL) return hit.profile
  try {
    const r = obj(await yahooFinance.quoteSummary(symbol, { modules: ["assetProfile", "quoteType"] }, NO_VALIDATION))
    const asset = obj(r.assetProfile)
    const profile: Profile = {
      sector: str(asset.sector),
      industry: str(asset.industry),
      country: str(asset.country),
      quoteType: str(obj(r.quoteType).quoteType),
    }
    profileCache.set(symbol, { at: Date.now(), profile })
    return profile
  } catch (e) {
    console.warn(`Yahoo profile request failed for ${symbol}:`, (e as Error).message)
    return hit?.profile ?? null
  }
}

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
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null)

/* Yahoo responses are left unvalidated (NO_VALIDATION), so read them as plain records */
type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {})
const list = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(obj) : [])

function mapQuote(q: Raw): Quote | null {
  const symbol = str(q.symbol)
  const price = num(q.regularMarketPrice)
  if (!symbol || price == null) return null
  const prevClose = num(q.regularMarketPreviousClose) ?? price
  const change = num(q.regularMarketChange) ?? price - prevClose
  const changePercent = num(q.regularMarketChangePercent) ?? (prevClose ? (change / prevClose) * 100 : 0)
  return {
    symbol,
    name: str(q.longName) ?? str(q.shortName) ?? symbol, // longName reads naturally ("The Boeing Company")
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
      num(q.dividendYield) ?? ((y) => (y != null ? y * 100 : null))(num(q.trailingAnnualDividendYield)),
    exchange: str(q.fullExchangeName) ?? str(q.exchange),
    currency: str(q.currency),
    // Freshness and session information
    marketState: str(q.marketState), // PRE | REGULAR | POST | POSTPOST | PREPRE | CLOSED
    asOf: toMs(q.regularMarketTime),
    timeZone: str(q.exchangeTimezoneName),
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

/* Yahoo answers USD pairs under either alias ("USDJPY=X" or "JPY=X"), and which one varies by batch */
const aliasKey = (s: string) => s.replace(/^USD([A-Z]{3})=X$/, "$1=X")

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
      const res = list(await yahooFinance.quote(missing, { return: "array" }, NO_VALIDATION))
      const requested = new Map(missing.map((s) => [aliasKey(s), s]))
      for (const q of res) {
        const mapped = mapQuote(q)
        if (!mapped) continue
        // File the quote under the symbol the client asked for
        const symbol = missing.includes(mapped.symbol) ? mapped.symbol : (requested.get(aliasKey(mapped.symbol)) ?? mapped.symbol)
        quoteCache.set(symbol, { at: now, quote: { ...mapped, symbol } })
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
    const chart = obj(
      await yahooFinance.chart(
        symbol,
        // Regular-session bars only, so "1D" is the trading day rather than 4 AM–8 PM
        { period1: new Date(Date.now() - c.back), interval: c.interval, includePrePost: false },
        NO_VALIDATION,
      ),
    )
    const meta = obj(chart.meta)
    const timeZone = str(meta.exchangeTimezoneName) ?? "America/New_York"
    let points: Point[] = list(chart.quotes).flatMap((q) => {
      const t = toMs(q.date)
      const price = num(q.close)
      return t != null && price != null ? [{ t, price, volume: num(q.volume) }] : []
    })

    let previousClose: number | null = num(meta.chartPreviousClose)
    if (timeframe === "1D" && points.length) {
      // Keep only the most recent trading session; its previous close is the prior session's last price
      const lastDay = dayKey(points[points.length - 1].t, timeZone)
      const firstIdx = points.findIndex((p) => dayKey(p.t, timeZone) === lastDay)
      previousClose = firstIdx > 0 ? points[firstIdx - 1].price : previousClose
      points = points.slice(firstIdx)
    }

    const data: ChartData = { points, timeZone, previousClose, currency: str(meta.currency) }
    chartCache.set(key, { at: Date.now(), data })
    return data
  } catch (e) {
    console.warn(`Yahoo chart request failed for ${symbol} ${timeframe}:`, (e as Error).message)
    return hit?.data ?? null // last good copy if we have one
  }
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

    if (action === "movers") {
      const result = await getMovers()
      if (!result) return NextResponse.json({ error: "Movers unavailable" }, { status: 503 })
      return NextResponse.json({ ...result.data, stale: result.stale })
    }

    if (action === "profiles") {
      if (!symbols.length) return NextResponse.json({ error: "Missing symbols parameter" }, { status: 400 })
      const entries = await Promise.all(symbols.map(async (s) => [s, await getProfile(s)] as const))
      return NextResponse.json({ profiles: Object.fromEntries(entries.filter(([, p]) => p)) })
    }

    if (action === "search") {
      const query = searchParams.get("query")
      if (!query) return NextResponse.json({ error: "Missing query parameter" }, { status: 400 })
      try {
        const results = obj(await yahooFinance.search(query, {}, NO_VALIDATION))
        const mappedResults = list(results.quotes)
          .flatMap((q) => {
            const symbol = str(q.symbol)
            if (!symbol || (q.quoteType !== "EQUITY" && q.quoteType !== "ETF")) return []
            return [{ symbol, name: str(q.shortname) ?? str(q.longname) ?? symbol, exchange: str(q.exchange) ?? "" }]
          })
          .slice(0, 5)
        return NextResponse.json({ results: mappedResults })
      } catch (e) {
        console.warn(`Ticker search failed for ${query}:`, (e as Error).message)
        return NextResponse.json({ error: "Search failed", results: [] }, { status: 503 })
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: (error instanceof Error && error.message) || "Internal server error" }, { status: 500 })
  }
}
