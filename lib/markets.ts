/*
 * World exchange trading hours and a small status engine.
 * Hours are regular local-time sessions; exchange holidays are not modelled.
 */

type Session = [start: string, end: string] // "HH:MM" local time

export type Market = {
  id: string
  name: string
  exchange: string
  city: string
  region: "Americas" | "Europe" | "Middle East & Africa" | "Asia-Pacific"
  timeZone: string
  days: number[] // 0 = Sunday … 6 = Saturday
  sessions: Session[] // one session, or two with a lunch break
  pre?: string // extended-hours start (US only)
  post?: string // extended-hours end (US only)
}

const MON_FRI = [1, 2, 3, 4, 5]

export const MARKETS: Market[] = [
  { id: "us", name: "United States", exchange: "NYSE · Nasdaq", city: "New York", region: "Americas", timeZone: "America/New_York", days: MON_FRI, sessions: [["09:30", "16:00"]], pre: "04:00", post: "20:00" },
  { id: "ca", name: "Canada", exchange: "TSX", city: "Toronto", region: "Americas", timeZone: "America/Toronto", days: MON_FRI, sessions: [["09:30", "16:00"]] },
  { id: "br", name: "Brazil", exchange: "B3", city: "São Paulo", region: "Americas", timeZone: "America/Sao_Paulo", days: MON_FRI, sessions: [["10:00", "17:00"]] },
  { id: "uk", name: "United Kingdom", exchange: "LSE", city: "London", region: "Europe", timeZone: "Europe/London", days: MON_FRI, sessions: [["08:00", "16:30"]] },
  { id: "de", name: "Germany", exchange: "Xetra", city: "Frankfurt", region: "Europe", timeZone: "Europe/Berlin", days: MON_FRI, sessions: [["09:00", "17:30"]] },
  { id: "fr", name: "France", exchange: "Euronext Paris", city: "Paris", region: "Europe", timeZone: "Europe/Paris", days: MON_FRI, sessions: [["09:00", "17:30"]] },
  { id: "ch", name: "Switzerland", exchange: "SIX", city: "Zurich", region: "Europe", timeZone: "Europe/Zurich", days: MON_FRI, sessions: [["09:00", "17:30"]] },
  { id: "sa", name: "Saudi Arabia", exchange: "Tadawul", city: "Riyadh", region: "Middle East & Africa", timeZone: "Asia/Riyadh", days: [0, 1, 2, 3, 4], sessions: [["10:00", "15:00"]] },
  { id: "za", name: "South Africa", exchange: "JSE", city: "Johannesburg", region: "Middle East & Africa", timeZone: "Africa/Johannesburg", days: MON_FRI, sessions: [["09:00", "17:00"]] },
  { id: "in", name: "India", exchange: "NSE · BSE", city: "Mumbai", region: "Asia-Pacific", timeZone: "Asia/Kolkata", days: MON_FRI, sessions: [["09:15", "15:30"]] },
  { id: "cn", name: "China", exchange: "SSE", city: "Shanghai", region: "Asia-Pacific", timeZone: "Asia/Shanghai", days: MON_FRI, sessions: [["09:30", "11:30"], ["13:00", "15:00"]] },
  { id: "hk", name: "Hong Kong", exchange: "HKEX", city: "Hong Kong", region: "Asia-Pacific", timeZone: "Asia/Hong_Kong", days: MON_FRI, sessions: [["09:30", "12:00"], ["13:00", "16:00"]] },
  { id: "jp", name: "Japan", exchange: "TSE", city: "Tokyo", region: "Asia-Pacific", timeZone: "Asia/Tokyo", days: MON_FRI, sessions: [["09:00", "11:30"], ["12:30", "15:30"]] },
  { id: "kr", name: "South Korea", exchange: "KRX", city: "Seoul", region: "Asia-Pacific", timeZone: "Asia/Seoul", days: MON_FRI, sessions: [["09:00", "15:30"]] },
  { id: "sg", name: "Singapore", exchange: "SGX", city: "Singapore", region: "Asia-Pacific", timeZone: "Asia/Singapore", days: MON_FRI, sessions: [["09:00", "12:00"], ["13:00", "17:00"]] },
  { id: "au", name: "Australia", exchange: "ASX", city: "Sydney", region: "Asia-Pacific", timeZone: "Australia/Sydney", days: MON_FRI, sessions: [["10:00", "16:00"]] },
]

export const DEFAULT_MARKET = "us"
export const marketById = (id: string) => MARKETS.find((m) => m.id === id)

export type MarketState = "open" | "pre" | "post" | "lunch" | "closed"

export type MarketStatus = {
  state: MarketState
  label: string
  detail: string
  progress: number // 0–1 through the current session window, 0 when closed
  localTime: string
  color: string
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const formatters = new Map<string, Intl.DateTimeFormat>()

function localParts(now: Date, timeZone: string) {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
    formatters.set(timeZone, f)
  }
  const parts = Object.fromEntries(f.formatToParts(now).map((p) => [p.type, p.value]))
  const day = WEEKDAYS.indexOf(parts.weekday)
  const seconds = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)
  return { day, seconds }
}

const toSec = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 3600 + m * 60
}

const fmtClock = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

const fmtIn = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h >= 1) return `${h}h ${m}m`
  if (m >= 1) return `${m}m ${s}s`
  return `${s}s`
}

export function getMarketStatus(market: Market, now: Date): MarketStatus {
  const { day, seconds: t } = localParts(now, market.timeZone)
  const localTime = now.toLocaleTimeString("en-US", { timeZone: market.timeZone, hour: "numeric", minute: "2-digit" })
  const tradingToday = market.days.includes(day)
  const sessions = market.sessions.map(([a, b]) => [toSec(a), toSec(b)] as const)
  const open = sessions[0][0]
  const close = sessions[sessions.length - 1][1]

  if (tradingToday) {
    for (let i = 0; i < sessions.length; i++) {
      const [s, e] = sessions[i]
      if (t >= s && t < e) {
        const last = i === sessions.length - 1
        return {
          state: "open",
          label: "Open",
          detail: last ? `Closes in ${fmtIn(e - t)}` : `Lunch break in ${fmtIn(e - t)}`,
          progress: (t - open) / (close - open),
          localTime,
          color: "var(--up)",
        }
      }
      const next = sessions[i + 1]
      if (next && t >= e && t < next[0]) {
        return {
          state: "lunch",
          label: "Lunch Break",
          detail: `Reopens in ${fmtIn(next[0] - t)}`,
          progress: (t - open) / (close - open),
          localTime,
          color: "var(--warn)",
        }
      }
    }
    if (market.pre && t >= toSec(market.pre) && t < open) {
      const pre = toSec(market.pre)
      return {
        state: "pre",
        label: "Pre-Market",
        detail: `Opens in ${fmtIn(open - t)}`,
        progress: (t - pre) / (open - pre),
        localTime,
        color: "var(--warn)",
      }
    }
    if (market.post && t >= close && t < toSec(market.post)) {
      const post = toSec(market.post)
      return {
        state: "post",
        label: "After Hours",
        detail: `Ends in ${fmtIn(post - t)}`,
        progress: (t - close) / (post - close),
        localTime,
        color: "var(--tint)",
      }
    }
  }

  // Closed: find the next regular open (or pre-market for the US)
  const startOf = market.pre ? toSec(market.pre) : open
  for (let d = 0; d <= 7; d++) {
    const dayIdx = (day + d) % 7
    if (!market.days.includes(dayIdx)) continue
    const until = d * 86400 + startOf - t
    if (until <= 0) continue
    const what = market.pre ? "Pre-market" : "Opens"
    const detail =
      until < 86400 ? `${what} in ${fmtIn(until)}` : `${market.pre ? "Pre-market" : "Opens"} ${WEEKDAYS[dayIdx]} ${fmtClock(startOf)}`
    return { state: "closed", label: "Closed", detail, progress: 0, localTime, color: "var(--label-3)" }
  }
  return { state: "closed", label: "Closed", detail: "", progress: 0, localTime, color: "var(--label-3)" }
}
