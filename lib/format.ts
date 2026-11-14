/* Number and money formatting that respects each instrument's currency */

// Yahoo quotes some exchanges in minor units: GBp (pence), ILA (agorot), ZAc (cents)
const MINOR_UNITS: Record<string, { major: string; suffix: string }> = {
  GBp: { major: "GBP", suffix: "p" },
  GBX: { major: "GBP", suffix: "p" },
  ILA: { major: "ILS", suffix: " ag" },
  ZAc: { major: "ZAR", suffix: "c" },
  ZAC: { major: "ZAR", suffix: "c" },
}

/** Price digits: 2 decimals, more for sub-unit prices, always grouped */
export function formatPrice(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—"
  const abs = Math.abs(n)
  const digits = abs > 0 && abs < 1 ? 4 : 2
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatSigned(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—"
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
  // A value that rounds to zero gets no sign ("0.00%", not "−0.00%")
  const zero = Number(Math.abs(n).toFixed(digits)) === 0
  return `${zero ? "" : n > 0 ? "+" : "−"}${s}`
}

export function formatPercent(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${formatSigned(n)}%`
}

/** Money in the instrument's own currency, e.g. $8.98, ₹1,234.50, 512.4p */
export function formatMoney(n: number | null | undefined, currency?: string | null, opts: { compact?: boolean } = {}) {
  if (n == null || !Number.isFinite(n)) return "—"
  const minor = currency ? MINOR_UNITS[currency] : undefined
  if (minor) {
    // Show large minor-unit amounts (e.g. market cap) in the major currency
    if (opts.compact) return formatMoney(n / 100, minor.major, opts)
    return `${formatPrice(n)}${minor.suffix}`
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      ...(opts.compact ? { notation: "compact", maximumFractionDigits: 2 } : {}),
    }).format(n)
  } catch {
    return `${opts.compact ? formatCompact(n) : formatPrice(n)} ${currency ?? ""}`.trim()
  }
}

export function formatCompact(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n === 0) return "—"
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
