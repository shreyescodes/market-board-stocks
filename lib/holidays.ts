/*
 * Exchange holiday calendars computed from each exchange's published rules.
 *
 * Covered: US (NYSE/Nasdaq), Canada (TSX), Brazil (B3), UK (LSE), Germany (Xetra),
 * France (Euronext Paris), Switzerland (SIX), South Africa (JSE), Australia (ASX), Japan (TSE).
 *
 * Not covered: China, Hong Kong, India, South Korea, Singapore and Saudi Arabia set their
 * holidays from lunar/religious calendars announced each year, so no dates are guessed here.
 * For those markets the app relies on Yahoo's live session state instead (see lib/markets.ts).
 *
 * Rules cannot foresee one-off closures (state funerals, royal events, emergencies); the live
 * session check catches those on the day.
 */

export type HolidayInfo = { name: string; earlyClose?: string; lateOpen?: string } // local "HH:MM"
type Calendar = Map<string, HolidayInfo>

export const CALENDAR_MARKETS = new Set(["us", "ca", "br", "uk", "de", "fr", "ch", "za", "au", "jp"])

/* ── date helpers (UTC-based calendar dates, no time zone involved) ── */
const key = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}
const weekday = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay()
const addDays = (y: number, m: number, d: number, n: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()] as const
}
/** n-th weekday (0=Sun…6=Sat) of a month, n = 1…5 */
const nthWeekday = (y: number, m: number, wd: number, n: number) => {
  const first = weekday(y, m, 1)
  return 1 + ((wd - first + 7) % 7) + (n - 1) * 7
}
const lastWeekday = (y: number, m: number, wd: number) => {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return lastDay - ((weekday(y, m, lastDay) - wd + 7) % 7)
}

/** Gregorian Easter Sunday (Anonymous Gregorian algorithm) */
export function easter(y: number) {
  const a = y % 19
  const b = Math.floor(y / 100)
  const c = y % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [month, day] as const
}
const easterOffset = (y: number, n: number) => {
  const [m, d] = easter(y)
  return addDays(y, m, d, n)
}

function builder() {
  const cal: Calendar = new Map()
  const add = (ymd: readonly [number, number, number], name: string, earlyClose?: string, lateOpen?: string) => {
    const k = key(...ymd)
    if (cal.has(k)) return
    const info: HolidayInfo = { name }
    if (earlyClose) info.earlyClose = earlyClose
    if (lateOpen) info.lateOpen = lateOpen
    cal.set(k, info)
  }
  return { cal, add }
}

/** Fixed date that moves to Monday if it falls on Sat/Sun */
const monIfWeekend = (y: number, m: number, d: number) => {
  const wd = weekday(y, m, d)
  return wd === 6 ? addDays(y, m, d, 2) : wd === 0 ? addDays(y, m, d, 1) : ([y, m, d] as const)
}
/** Fixed date that moves to Friday if Saturday, Monday if Sunday (US federal style) */
const nearestWeekday = (y: number, m: number, d: number) => {
  const wd = weekday(y, m, d)
  return wd === 6 ? addDays(y, m, d, -1) : wd === 0 ? addDays(y, m, d, 1) : ([y, m, d] as const)
}
/** Christmas + Boxing Day with UK/Canada/Australia substitution */
const christmasPair = (y: number, add: (ymd: readonly [number, number, number], n: string) => void, boxing = "Boxing Day") => {
  const wd = weekday(y, 12, 25)
  if (wd === 5) {
    add([y, 12, 25], "Christmas Day")
    add([y, 12, 28], boxing) // Boxing Day Saturday → Monday
  } else if (wd === 6) {
    add([y, 12, 27], "Christmas Day (observed)")
    add([y, 12, 28], `${boxing} (observed)`)
  } else if (wd === 0) {
    add([y, 12, 26], boxing)
    add([y, 12, 27], "Christmas Day (observed)")
  } else {
    add([y, 12, 25], "Christmas Day")
    add([y, 12, 26], boxing)
  }
}
const isWeekday = (y: number, m: number, d: number) => {
  const wd = weekday(y, m, d)
  return wd !== 0 && wd !== 6
}

/* ── calendars ── */
function us(y: number) {
  const { cal, add } = builder()
  // NYSE does not observe New Year's Day on the prior Friday when Jan 1 is a Saturday
  if (weekday(y, 1, 1) !== 6) add(monIfWeekend(y, 1, 1), "New Year's Day")
  add([y, 1, nthWeekday(y, 1, 1, 3)], "Martin Luther King Jr. Day")
  add([y, 2, nthWeekday(y, 2, 1, 3)], "Washington's Birthday")
  add(easterOffset(y, -2), "Good Friday")
  add([y, 5, lastWeekday(y, 5, 1)], "Memorial Day")
  if (y >= 2022) add(nearestWeekday(y, 6, 19), "Juneteenth")
  add(nearestWeekday(y, 7, 4), "Independence Day")
  add([y, 9, nthWeekday(y, 9, 1, 1)], "Labor Day")
  const thanksgiving = nthWeekday(y, 11, 4, 4)
  add([y, 11, thanksgiving], "Thanksgiving Day")
  add(nearestWeekday(y, 12, 25), "Christmas Day")
  // Early closes at 1:00 PM ET
  const jul4 = weekday(y, 7, 4)
  if (jul4 >= 2 && jul4 <= 5) add([y, 7, 3], "Independence Day eve", "13:00")
  add([y, 11, thanksgiving + 1], "Day after Thanksgiving", "13:00")
  if (isWeekday(y, 12, 24) && weekday(y, 12, 25) !== 6) add([y, 12, 24], "Christmas Eve", "13:00")
  return cal
}

function ca(y: number) {
  const { cal, add } = builder()
  add(monIfWeekend(y, 1, 1), "New Year's Day")
  add([y, 2, nthWeekday(y, 2, 1, 3)], "Family Day")
  add(easterOffset(y, -2), "Good Friday")
  add([y, 5, 24 - ((weekday(y, 5, 24) + 6) % 7)], "Victoria Day") // Monday on or before May 24
  add(monIfWeekend(y, 7, 1), "Canada Day")
  add([y, 8, nthWeekday(y, 8, 1, 1)], "Civic Holiday")
  add([y, 9, nthWeekday(y, 9, 1, 1)], "Labour Day")
  add([y, 10, nthWeekday(y, 10, 1, 2)], "Thanksgiving Day")
  christmasPair(y, add)
  if (isWeekday(y, 12, 24)) add([y, 12, 24], "Christmas Eve", "13:00")
  return cal
}

function br(y: number) {
  const { cal, add } = builder()
  add([y, 1, 1], "New Year's Day")
  add(easterOffset(y, -48), "Carnival")
  add(easterOffset(y, -47), "Carnival")
  add(easterOffset(y, -46), "Ash Wednesday", undefined, "13:00") // B3 opens at 1:00 PM
  add(easterOffset(y, -2), "Good Friday")
  add([y, 4, 21], "Tiradentes")
  add([y, 5, 1], "Labour Day")
  add(easterOffset(y, 60), "Corpus Christi")
  add([y, 9, 7], "Independence Day")
  add([y, 10, 12], "Our Lady of Aparecida")
  add([y, 11, 2], "All Souls' Day")
  add([y, 11, 15], "Republic Day")
  if (y >= 2024) add([y, 11, 20], "Black Consciousness Day")
  add([y, 12, 24], "Christmas Eve")
  add([y, 12, 25], "Christmas Day")
  add([y, 12, 31], "New Year's Eve")
  return cal
}

function uk(y: number) {
  const { cal, add } = builder()
  add(monIfWeekend(y, 1, 1), "New Year's Day")
  add(easterOffset(y, -2), "Good Friday")
  add(easterOffset(y, 1), "Easter Monday")
  add([y, 5, nthWeekday(y, 5, 1, 1)], "Early May Bank Holiday")
  add([y, 5, lastWeekday(y, 5, 1)], "Spring Bank Holiday")
  add([y, 8, lastWeekday(y, 8, 1)], "Summer Bank Holiday")
  christmasPair(y, add)
  if (isWeekday(y, 12, 24)) add([y, 12, 24], "Christmas Eve", "12:30")
  if (isWeekday(y, 12, 31)) add([y, 12, 31], "New Year's Eve", "12:30")
  return cal
}

function de(y: number) {
  const { cal, add } = builder()
  add([y, 1, 1], "New Year's Day")
  add(easterOffset(y, -2), "Good Friday")
  add(easterOffset(y, 1), "Easter Monday")
  add([y, 5, 1], "Labour Day")
  add([y, 12, 24], "Christmas Eve")
  add([y, 12, 25], "Christmas Day")
  add([y, 12, 26], "Boxing Day")
  add([y, 12, 31], "New Year's Eve")
  return cal
}

function fr(y: number) {
  const { cal, add } = builder()
  add([y, 1, 1], "New Year's Day")
  add(easterOffset(y, -2), "Good Friday")
  add(easterOffset(y, 1), "Easter Monday")
  add([y, 5, 1], "Labour Day")
  add([y, 12, 25], "Christmas Day")
  add([y, 12, 26], "Boxing Day")
  add([y, 12, 24], "Christmas Eve", "14:05")
  add([y, 12, 31], "New Year's Eve", "14:05")
  return cal
}

function ch(y: number) {
  const { cal, add } = builder()
  add([y, 1, 1], "New Year's Day")
  add([y, 1, 2], "Berchtold's Day")
  add(easterOffset(y, -2), "Good Friday")
  add(easterOffset(y, 1), "Easter Monday")
  add(easterOffset(y, 39), "Ascension Day")
  add(easterOffset(y, 50), "Whit Monday")
  add([y, 5, 1], "Labour Day")
  add([y, 8, 1], "Swiss National Day")
  add([y, 12, 24], "Christmas Eve")
  add([y, 12, 25], "Christmas Day")
  add([y, 12, 26], "St. Stephen's Day")
  add([y, 12, 31], "New Year's Eve")
  return cal
}

function za(y: number) {
  const { cal, add } = builder()
  // South Africa: a public holiday on Sunday is observed on Monday
  const sunToMon = (m: number, d: number, name: string) => {
    add([y, m, d], name)
    if (weekday(y, m, d) === 0) add(addDays(y, m, d, 1), `${name} (observed)`)
  }
  sunToMon(1, 1, "New Year's Day")
  sunToMon(3, 21, "Human Rights Day")
  add(easterOffset(y, -2), "Good Friday")
  add(easterOffset(y, 1), "Family Day")
  sunToMon(4, 27, "Freedom Day")
  sunToMon(5, 1, "Workers' Day")
  sunToMon(6, 16, "Youth Day")
  sunToMon(8, 9, "National Women's Day")
  sunToMon(9, 24, "Heritage Day")
  sunToMon(12, 16, "Day of Reconciliation")
  sunToMon(12, 25, "Christmas Day")
  sunToMon(12, 26, "Day of Goodwill")
  return cal
}

function au(y: number) {
  const { cal, add } = builder()
  add(monIfWeekend(y, 1, 1), "New Year's Day")
  add(monIfWeekend(y, 1, 26), "Australia Day")
  add(easterOffset(y, -2), "Good Friday")
  add(easterOffset(y, 1), "Easter Monday")
  if (isWeekday(y, 4, 25)) add([y, 4, 25], "Anzac Day")
  add([y, 6, nthWeekday(y, 6, 1, 2)], "King's Birthday")
  christmasPair(y, add)
  if (isWeekday(y, 12, 24)) add([y, 12, 24], "Christmas Eve", "14:10")
  if (isWeekday(y, 12, 31)) add([y, 12, 31], "New Year's Eve", "14:10")
  return cal
}

function jp(y: number) {
  const { cal, add } = builder()
  const base = new Map<string, string>()
  const put = (m: number, d: number, name: string) => base.set(key(y, m, d), name)
  // Equinox days: standard formula, valid 1980–2099
  const n = y - 1980
  const vernal = Math.floor(20.8431 + 0.242194 * n - Math.floor(n / 4))
  const autumnal = Math.floor(23.2488 + 0.242194 * n - Math.floor(n / 4))
  put(1, 1, "New Year's Day")
  put(1, nthWeekday(y, 1, 1, 2), "Coming of Age Day")
  put(2, 11, "National Foundation Day")
  put(2, 23, "Emperor's Birthday")
  put(3, vernal, "Vernal Equinox Day")
  put(4, 29, "Showa Day")
  put(5, 3, "Constitution Memorial Day")
  put(5, 4, "Greenery Day")
  put(5, 5, "Children's Day")
  put(7, nthWeekday(y, 7, 1, 3), "Marine Day")
  put(8, 11, "Mountain Day")
  put(9, nthWeekday(y, 9, 1, 3), "Respect for the Aged Day")
  put(9, autumnal, "Autumnal Equinox Day")
  put(10, nthWeekday(y, 10, 1, 2), "Sports Day")
  put(11, 3, "Culture Day")
  put(11, 23, "Labor Thanksgiving Day")
  // Citizens' holiday: a weekday sandwiched between two national holidays
  for (const [k] of [...base]) {
    const [yy, mm, dd] = k.split("-").map(Number)
    const next = addDays(yy, mm, dd, 1)
    const after = addDays(yy, mm, dd, 2)
    if (!base.has(key(...next)) && base.has(key(...after)) && weekday(...next) !== 0) {
      base.set(key(...next), "Citizens' Holiday")
    }
  }
  // Substitute holiday: a holiday on Sunday moves to the next non-holiday day
  for (const [k, name] of [...base]) {
    const [yy, mm, dd] = k.split("-").map(Number)
    if (weekday(yy, mm, dd) !== 0) continue
    let i = 1
    while (base.has(key(...addDays(yy, mm, dd, i)))) i++
    base.set(key(...addDays(yy, mm, dd, i)), `${name} (substitute)`)
  }
  for (const [k, name] of base) {
    const [yy, mm, dd] = k.split("-").map(Number)
    add([yy, mm, dd], name)
  }
  // TSE year-end/new-year closure
  add([y, 1, 2], "Market holiday")
  add([y, 1, 3], "Market holiday")
  add([y, 12, 31], "Market holiday")
  return cal
}

const BUILDERS: Record<string, (y: number) => Calendar> = { us, ca, br, uk, de, fr, ch, za, au, jp }
const cache = new Map<string, Calendar>()

/** Holiday or early close for a market on a local calendar date ("YYYY-MM-DD") */
export function holidayOn(marketId: string, dateKey: string): HolidayInfo | null {
  const build = BUILDERS[marketId]
  if (!build) return null
  const year = Number(dateKey.slice(0, 4))
  const ck = `${marketId}-${year}`
  let cal = cache.get(ck)
  if (!cal) {
    cal = build(year)
    cache.set(ck, cal)
  }
  return cal.get(dateKey) ?? null
}
