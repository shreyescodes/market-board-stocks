/* Number and money formatting that respects each instrument's currency and local conventions */

// Yahoo quotes some exchanges in minor units: GBp (pence), ILA (agorot), ZAc (cents)
const MINOR_UNITS: Record<string, { major: string; suffix: string }> = {
  GBp: { major: "GBP", suffix: "p" },
  GBX: { major: "GBP", suffix: "p" },
  ILA: { major: "ILS", suffix: " ag" },
  ZAc: { major: "ZAR", suffix: "c" },
  ZAC: { major: "ZAR", suffix: "c" },
}

/** Digit grouping follows the currency's home convention: India groups in lakhs (3,66,244.91) */
export const localeFor = (currency?: string | null) => (currency === "INR" ? "en-IN" : "en-US")

/** Price digits: 2 decimals, more for sub-unit prices, always grouped */
export function formatPrice(n: number | null | undefined, currency?: string | null) {
  if (n == null || !Number.isFinite(n)) return "—"
  const abs = Math.abs(n)
  const digits = abs > 0 && abs < 1 ? 4 : 2
  return n.toLocaleString(localeFor(currency), { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatSigned(n: number | null | undefined, digits = 2, currency?: string | null) {
  if (n == null || !Number.isFinite(n)) return "—"
  const s = Math.abs(n).toLocaleString(localeFor(currency), { minimumFractionDigits: digits, maximumFractionDigits: digits })
  // A value that rounds to zero gets no sign ("0.00%", not "−0.00%")
  const zero = Number(Math.abs(n).toFixed(digits)) === 0
  return `${zero ? "" : n > 0 ? "+" : "−"}${s}`
}

export function formatPercent(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${formatSigned(n)}%`
}

/** Indian convention for large rupee amounts: ₹400.5 cr, ₹12.41 lakh cr */
function formatInrCompact(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? "−" : ""
  const fmt = (v: number, d: number) => v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d })
  if (abs >= 1e12) return `${sign}₹${fmt(abs / 1e12, 2)} lakh cr`
  if (abs >= 1e7) return `${sign}₹${fmt(abs / 1e7, abs >= 1e10 ? 0 : 1)} cr`
  if (abs >= 1e5) return `${sign}₹${fmt(abs / 1e5, 2)} lakh`
  return `${sign}₹${fmt(abs, 0)}`
}

/** Money in the instrument's own currency, e.g. $8.98, ₹3,66,244.91, 512.4p */
export function formatMoney(n: number | null | undefined, currency?: string | null, opts: { compact?: boolean } = {}) {
  if (n == null || !Number.isFinite(n)) return "—"
  const minor = currency ? MINOR_UNITS[currency] : undefined
  if (minor) {
    // Show large minor-unit amounts (e.g. market cap) in the major currency
    if (opts.compact) return formatMoney(n / 100, minor.major, opts)
    return `${formatPrice(n)}${minor.suffix}`
  }
  if (opts.compact && currency === "INR") return formatInrCompact(n)
  const abs = Math.abs(n)
  const digits = !opts.compact && abs > 0 && abs < 1 ? 4 : undefined
  try {
    return new Intl.NumberFormat(localeFor(currency), {
      style: "currency",
      currency: currency || "USD",
      ...(digits ? { minimumFractionDigits: digits, maximumFractionDigits: digits } : {}),
      ...(opts.compact ? { notation: "compact", maximumFractionDigits: 2 } : {}),
    }).format(n)
  } catch {
    return `${opts.compact ? formatCompact(n) : formatPrice(n)} ${currency ?? ""}`.trim()
  }
}

/** A signed money amount, e.g. +₹196.44, −$0.30 */
export function formatSignedMoney(n: number | null | undefined, currency?: string | null) {
  if (n == null || !Number.isFinite(n)) return "—"
  const zero = Math.abs(n) < 0.005
  return `${zero ? "" : n > 0 ? "+" : "−"}${formatMoney(Math.abs(n), currency)}`
}

export function formatCompact(n: number | null | undefined, currency?: string | null) {
  if (n == null || !Number.isFinite(n) || n === 0) return "—"
  if (currency === "INR") {
    // Share counts in India read as lakh and crore (2.34 cr)
    const abs = Math.abs(n)
    if (abs >= 1e7) return `${(n / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} cr`
    if (abs >= 1e5) return `${(n / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh`
  }
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n)
}

/** Time in a given IANA zone with its short name, e.g. "3:58 PM EST" */
export function formatTimeIn(t: number | null | undefined, timeZone?: string | null, withZone = true) {
  if (t == null) return "—"
  return new Date(t).toLocaleTimeString("en-US", {
    timeZone: timeZone || undefined,
    hour: "numeric",
    minute: "2-digit",
    ...(withZone ? { timeZoneName: "short" } : {}),
  })
}

/** "updated 2 min ago" style age for status lines */
export function formatAge(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 45) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} d ago`
}

/** Company names without legal suffixes: "Eicher Motors Limited" → "Eicher Motors", "Apple Inc." → "Apple" */
export function shortName(name?: string | null) {
  if (!name) return ""
  const cleaned = name
    .replace(/,?\s+(Inc\.?|Incorporated|Corporation|Corp\.?|Limited|Ltd\.?|plc|PLC|N\.V\.|S\.A\.|SE|AG|Co\.,?\s*Ltd\.?|Company Limited)$/i, "")
    .replace(/\s+\(The\)$/i, "")
    .trim()
  return cleaned || name
}

/** Ticker without the exchange suffix where it reads cleanly: "RELIANCE.NS" → "RELIANCE"; numeric codes keep theirs */
export const displaySymbol = (s: string) => (/^\d/.test(s) ? s : s.replace(/\.[A-Z]{1,3}$/, ""))
