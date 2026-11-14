/*
 * Portfolio valuation in a single base currency (USD).
 *
 * - Prices quoted in minor units (GBp pence, ILA agorot, ZAc cents) are converted to major units.
 * - Each currency is converted with Yahoo's live <CUR>USD=X rate. Day P&L uses the previous close
 *   of both the price and the FX rate, so it includes currency moves.
 * - Cost basis is converted at today's FX rate (no historical FX), which the UI states.
 * - A position without a quote or FX rate is left out of the totals and flagged — never estimated.
 */
import type { Position } from "./storage"
import type { Stock } from "./stock-types"

export const BASE_CURRENCY = "USD"

const MINOR_UNITS: Record<string, { major: string; div: number }> = {
  GBp: { major: "GBP", div: 100 },
  GBX: { major: "GBP", div: 100 },
  ILA: { major: "ILS", div: 100 },
  ZAc: { major: "ZAR", div: 100 },
  ZAC: { major: "ZAR", div: 100 },
}

export function majorCurrency(currency?: string | null) {
  const cur = currency || BASE_CURRENCY
  const minor = MINOR_UNITS[cur]
  return minor ? { code: minor.major, div: minor.div } : { code: cur.toUpperCase(), div: 1 }
}

/** Yahoo symbol giving the USD value of one unit of `code` */
export const fxSymbol = (code: string) => (code === BASE_CURRENCY ? null : `${code}${BASE_CURRENCY}=X`)

export type HoldingRow = {
  position: Position
  quote?: Stock
  currency: string // quote currency as Yahoo reports it (may be a minor unit)
  baseCode: string // major currency code
  value?: number // USD
  dayPnl?: number
  dayPct?: number
  costBasis?: number
  totalPnl?: number
  totalPct?: number
  weight?: number
  issue?: "no-quote" | "no-fx"
}

export type PortfolioSummary = {
  rows: HoldingRow[]
  value: number
  dayPnl: number
  dayPct: number | null
  costBasis: number
  totalPnl: number
  totalPct: number | null
  excluded: number
  asOf: number | null
}

export function valuePortfolio(positions: Position[], quotes: Record<string, Stock>): PortfolioSummary {
  let value = 0
  let prevValue = 0
  let costBasis = 0
  let excluded = 0
  let asOf: number | null = null

  const rows: HoldingRow[] = positions.map((position) => {
    const quote = quotes[position.symbol]
    if (!quote) {
      excluded++
      return { position, currency: "—", baseCode: "—", issue: "no-quote" }
    }
    const { code, div } = majorCurrency(quote.currency)
    const fx = code === BASE_CURRENCY ? quote : quotes[fxSymbol(code)!]
    const rate = code === BASE_CURRENCY ? 1 : fx?.price
    const ratePrev = code === BASE_CURRENCY ? 1 : fx?.prevClose || fx?.price
    if (!rate || !ratePrev) {
      excluded++
      return { position, quote, currency: quote.currency ?? "", baseCode: code, issue: "no-fx" }
    }

    const v = (position.shares * quote.price * rate) / div
    const pv = (position.shares * (quote.prevClose || quote.price) * ratePrev) / div
    const cb = (position.shares * position.cost * rate) / div
    value += v
    prevValue += pv
    costBasis += cb
    if (quote.asOf) asOf = Math.max(asOf ?? 0, quote.asOf)
    return {
      position,
      quote,
      currency: quote.currency ?? "",
      baseCode: code,
      value: v,
      dayPnl: v - pv,
      dayPct: pv ? ((v - pv) / pv) * 100 : 0,
      costBasis: cb,
      totalPnl: v - cb,
      totalPct: cb ? ((v - cb) / cb) * 100 : null,
    } as HoldingRow
  })

  for (const r of rows) if (r.value != null && value > 0) r.weight = (r.value / value) * 100

  const dayPnl = value - prevValue
  return {
    rows,
    value,
    dayPnl,
    dayPct: prevValue ? (dayPnl / prevValue) * 100 : null,
    costBasis,
    totalPnl: value - costBasis,
    totalPct: costBasis ? ((value - costBasis) / costBasis) * 100 : null,
    excluded,
    asOf,
  }
}

/** Group values by a key, largest first, folding everything past `max` into "Other" */
export function allocation(items: { label: string; value: number }[], max = 8) {
  const total = items.reduce((s, i) => s + i.value, 0)
  const grouped = new Map<string, number>()
  for (const i of items) grouped.set(i.label, (grouped.get(i.label) ?? 0) + i.value)
  const sorted = [...grouped.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  const head = sorted.slice(0, max)
  const tail = sorted.slice(max).reduce((s, i) => s + i.value, 0)
  if (tail > 0) head.push({ label: "Other", value: tail })
  return head.map((i) => ({ ...i, pct: total ? (i.value / total) * 100 : 0 }))
}
