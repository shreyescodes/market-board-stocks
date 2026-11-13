/*
 * World exchange trading hours and status.
 *
 * Status combines two sources:
 *  1. The schedule: regular sessions plus the holiday/early-close calendars in lib/holidays.ts
 *     (used for countdowns and "opens Tue 9:30 AM" even across holidays)
 *  2. Yahoo's live session state for each market's main index: if the schedule says a market
 *     should be trading but it hasn't traded today, it is shown as closed. This covers markets
 *     whose holidays are announced yearly (China, Hong Kong, India, Korea, Singapore, Saudi Arabia)
 *     and one-off closures no calendar can predict.
 */
import { CALENDAR_MARKETS, holidayOn, type HolidayInfo } from "./holidays"

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
  probe: string // Yahoo symbol whose live session state represents this market
}

const MON_FRI = [1, 2, 3, 4, 5]

export const MARKETS: Market[] = [
  { id: "us", name: "United States", exchange: "NYSE · Nasdaq", city: "New York", region: "Americas", timeZone: "America/New_York", days: MON_FRI, sessions: [["09:30", "16:00"]], pre: "04:00", post: "20:00", probe: "^GSPC" },
  { id: "ca", name: "Canada", exchange: "TSX", city: "Toronto", region: "Americas", timeZone: "America/Toronto", days: MON_FRI, sessions: [["09:30", "16:00"]], probe: "^GSPTSE" },
  { id: "br", name: "Brazil", exchange: "B3", city: "São Paulo", region: "Americas", timeZone: "America/Sao_Paulo", days: MON_FRI, sessions: [["10:00", "17:00"]], probe: "^BVSP" },
  { id: "uk", name: "United Kingdom", exchange: "LSE", city: "London", region: "Europe", timeZone: "Europe/London", days: MON_FRI, sessions: [["08:00", "16:30"]], probe: "^FTSE" },
  { id: "de", name: "Germany", exchange: "Xetra", city: "Frankfurt", region: "Europe", timeZone: "Europe/Berlin", days: MON_FRI, sessions: [["09:00", "17:30"]], probe: "^GDAXI" },
  { id: "fr", name: "France", exchange: "Euronext Paris", city: "Paris", region: "Europe", timeZone: "Europe/Paris", days: MON_FRI, sessions: [["09:00", "17:30"]], probe: "^FCHI" },
  { id: "ch", name: "Switzerland", exchange: "SIX", city: "Zurich", region: "Europe", timeZone: "Europe/Zurich", days: MON_FRI, sessions: [["09:00", "17:30"]], probe: "^SSMI" },
  { id: "sa", name: "Saudi Arabia", exchange: "Tadawul", city: "Riyadh", region: "Middle East & Africa", timeZone: "Asia/Riyadh", days: [0, 1, 2, 3, 4], sessions: [["10:00", "15:00"]], probe: "^TASI.SR" },
  { id: "za", name: "South Africa", exchange: "JSE", city: "Johannesburg", region: "Middle East & Africa", timeZone: "Africa/Johannesburg", days: MON_FRI, sessions: [["09:00", "17:00"]], probe: "^J203.JO" },
  { id: "in", name: "India", exchange: "NSE · BSE", city: "Mumbai", region: "Asia-Pacific", timeZone: "Asia/Kolkata", days: MON_FRI, sessions: [["09:15", "15:30"]], probe: "^NSEI" },
  { id: "cn", name: "China", exchange: "SSE · SZSE", city: "Shanghai", region: "Asia-Pacific", timeZone: "Asia/Shanghai", days: MON_FRI, sessions: [["09:30", "11:30"], ["13:00", "15:00"]], probe: "000001.SS" },
  { id: "hk", name: "Hong Kong", exchange: "HKEX", city: "Hong Kong", region: "Asia-Pacific", timeZone: "Asia/Hong_Kong", days: MON_FRI, sessions: [["09:30", "12:00"], ["13:00", "16:00"]], probe: "^HSI" },
  { id: "jp", name: "Japan", exchange: "TSE", city: "Tokyo", region: "Asia-Pacific", timeZone: "Asia/Tokyo", days: MON_FRI, sessions: [["09:00", "11:30"], ["12:30", "15:30"]], probe: "^N225" },
  { id: "kr", name: "South Korea", exchange: "KRX", city: "Seoul", region: "Asia-Pacific", timeZone: "Asia/Seoul", days: MON_FRI, sessions: [["09:00", "15:30"]], probe: "^KS11" },
  { id: "sg", name: "Singapore", exchange: "SGX", city: "Singapore", region: "Asia-Pacific", timeZone: "Asia/Singapore", days: MON_FRI, sessions: [["09:00", "12:00"], ["13:00", "17:00"]], probe: "^STI" },
  { id: "au", name: "Australia", exchange: "ASX", city: "Sydney", region: "Asia-Pacific", timeZone: "Australia/Sydney", days: MON_FRI, sessions: [["10:00", "16:00"]], probe: "^AXJO" },
]

export const DEFAULT_MARKET = "us"
export const marketById = (id: string) => MARKETS.find((m) => m.id === id)
export const hasHolidayCalendar = (id: string) => CALENDAR_MARKETS.has(id)

export type MarketState = "open" | "pre" | "post" | "lunch" | "closed" | "holiday"

export type MarketStatus = {
  state: MarketState
  label: string
  detail: string
  progress: number // 0–1 through the current session window, 0 when closed
  localTime: string
  color: string
  holiday?: string // name of today's holiday or early close, when known
}

/** Yahoo's live view of a market, from its probe symbol */
export type LiveSession = { marketState: string | null; lastTrade: number | null }

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const formatters = new Map<string, Intl.DateTimeFormat>()

function localParts(at: Date | number, timeZone: string) {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
    formatters.set(timeZone, f)
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]))
  const y = Number(p.year)
  const m = Number(p.month)
  const d = Number(p.day)
  return { y, m, d, seconds: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) }
}

const dateKey = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toISOString().slice(0, 10)
}
const shiftDate = (y: number, m: number, d: number, n: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), weekday: dt.getUTCDay() }
}

const toSec = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 3600 + m * 60
}

const fmtClock = (sec: number) =>
  new Date(2000, 0, 1, Math.floor(sec / 3600), Math.floor((sec % 3600) / 60)).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

const fmtIn = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h >= 1) return `${h}h ${m}m`
  if (m >= 1) return `${m}m ${s}s`
  return `${s}s`
}

type DayPlan = { trading: boolean; sessions: [number, number][]; holiday: HolidayInfo | null }

/** Sessions for one local calendar date, after holidays, early closes and late opens */
function planFor(market: Market, y: number, m: number, d: number): DayPlan {
  const { weekday } = shiftDate(y, m, d, 0)
  const holiday = holidayOn(market.id, dateKey(y, m, d))
  if (!market.days.includes(weekday)) return { trading: false, sessions: [], holiday: null }
  if (holiday && !holiday.earlyClose && !holiday.lateOpen) return { trading: false, sessions: [], holiday }
  let sessions = market.sessions.map(([a, b]) => [toSec(a), toSec(b)] as [number, number])
  if (holiday?.lateOpen) {
    const start = toSec(holiday.lateOpen)
    sessions = sessions.map(([s, e]) => [Math.max(s, start), e] as [number, number]).filter(([s, e]) => e > s)
  }
  if (holiday?.earlyClose) {
    const end = toSec(holiday.earlyClose)
    sessions = sessions.map(([s, e]) => [s, Math.min(e, end)] as [number, number]).filter(([s, e]) => e > s)
  }
  return { trading: sessions.length > 0, sessions, holiday }
}

/** First trading start strictly after `t` on day offset `fromDay` or later */
function nextOpen(market: Market, y: number, m: number, d: number, t: number, fromDay: number) {
  for (let off = fromDay; off <= 21; off++) {
    const day = shiftDate(y, m, d, off)
    const plan = planFor(market, day.y, day.m, day.d)
    if (!plan.trading) continue
    const start = market.pre && !plan.holiday?.lateOpen ? toSec(market.pre) : plan.sessions[0][0]
    const until = off * 86400 + start - t
    if (until <= 0) continue
    const what = market.pre ? "Pre-market" : "Opens"
    if (until < 86400) return `${what} in ${fmtIn(until)}`
    const when =
      off >= 6
        ? new Date(Date.UTC(day.y, day.m - 1, day.d)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })
        : WEEKDAYS[day.weekday]
    return `${what} ${when} ${fmtClock(start)}`
  }
  return ""
}

export function getMarketStatus(market: Market, now: Date, live?: LiveSession | null): MarketStatus {
  const { y, m, d, seconds: t } = localParts(now, market.timeZone)
  const localTime = now.toLocaleTimeString("en-US", { timeZone: market.timeZone, hour: "numeric", minute: "2-digit" })
  const today = planFor(market, y, m, d)
  const holidayName = today.holiday?.name

  if (today.trading) {
    const s = today.sessions
    const open = s[0][0]
    const close = s[s.length - 1][1]

    // Live check: scheduled to trade, well past the open, yet nothing has traded today
    const liveClosed =
      !!live?.lastTrade &&
      live.marketState !== "REGULAR" &&
      t > open + 15 * 60 &&
      t < close &&
      (() => {
        const lt = localParts(live.lastTrade!, market.timeZone)
        return dateKey(lt.y, lt.m, lt.d) !== dateKey(y, m, d)
      })()
    if (liveClosed) {
      return {
        state: "holiday",
        label: "Closed Today",
        detail: `No trading today · ${nextOpen(market, y, m, d, t, 1)}`,
        progress: 0,
        localTime,
        color: "var(--label-3)",
        holiday: "No trading today",
      }
    }

    for (let i = 0; i < s.length; i++) {
      const [start, end] = s[i]
      if (t >= start && t < end) {
        const last = i === s.length - 1
        return {
          state: "open",
          label: "Open",
          detail: last
            ? today.holiday?.earlyClose
              ? `Early close in ${fmtIn(end - t)}`
              : `Closes in ${fmtIn(end - t)}`
            : `Lunch break in ${fmtIn(end - t)}`,
          progress: (t - open) / (close - open),
          localTime,
          color: "var(--up)",
          holiday: today.holiday?.earlyClose ? `${holidayName} · closes ${fmtClock(close)}` : holidayName,
        }
      }
      const next = s[i + 1]
      if (next && t >= end && t < next[0]) {
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
    if (market.pre && !today.holiday?.lateOpen && t >= toSec(market.pre) && t < open) {
      const pre = toSec(market.pre)
      return {
        state: "pre",
        label: "Pre-Market",
        detail: `Opens in ${fmtIn(open - t)}`,
        progress: (t - pre) / (open - pre),
        localTime,
        color: "var(--warn)",
        holiday: today.holiday?.earlyClose ? `Early close today at ${fmtClock(close)}` : undefined,
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

  // Closed for the day (weekend, holiday, or outside hours)
  const next = nextOpen(market, y, m, d, t, 0)
  if (today.holiday && !today.trading) {
    return {
      state: "holiday",
      label: "Holiday",
      detail: `${holidayName} · ${next}`,
      progress: 0,
      localTime,
      color: "var(--label-3)",
      holiday: holidayName,
    }
  }
  return { state: "closed", label: "Closed", detail: next, progress: 0, localTime, color: "var(--label-3)" }
}
