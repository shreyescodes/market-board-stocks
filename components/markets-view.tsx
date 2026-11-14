"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { MarketBar } from "./market-bar"
import { ChangePill } from "./liquid-glass"
import { useMarket } from "./market-context"
import { useQuotes } from "@/hooks/use-quotes"
import { usePoll } from "@/hooks/use-poll"
import { fetchMovers, type Movers } from "@/lib/stock-data"
import { formatCompact, formatMoney, formatPercent, formatPrice, formatSigned } from "@/lib/format"
import { indexesFor } from "@/lib/indices"
import type { Market } from "@/lib/markets"
import {
  COMMODITIES,
  CRYPTO,
  fxPairs,
  largeCapsFor,
  profileFor,
  rateSymbol,
  type Commodity,
  type Instrument,
  type Kind,
  type LargeCap,
} from "@/lib/market-profiles"
import type { Direction, Stock } from "@/lib/stock-types"
import { cn } from "@/lib/utils"

/* ───────────────────────── What to show for the selected market ───────────────────────── */

/** A row priced in the market's currency, converted from the instrument's own when they differ */
type Row = Instrument & { priced?: Commodity }
type Group = { title: string; note: string; rows: Row[] }
type Board = { currency: string; groups: Group[]; symbols: string[]; sectors: { note: string; items: { symbol: string; name: string }[] } | null; caps: LargeCap[] }

const baseCurrency = (c: Commodity) => (c.currency === "USX" ? "USD" : c.currency)

function buildBoard(market: Market): Board {
  const p = profileFor(market.id)
  const local = p.currency
  const priced = (c: Commodity): Row => ({ symbol: c.symbol, name: c.name, priced: c })
  const inLocal = local === "USD" ? "" : ` · in ${local}`

  const groups: Group[] = [
    p.rates
      ? { title: "Rates", note: "Treasury yields · change in basis points", rows: p.rates }
      : {
          title: "Benchmarks",
          note: market.exchange,
          // Euro Stoxx 50 is listed under several markets; show each index once
          rows: [...new Map(indexesFor(market.id).map((i) => [i.symbol, { symbol: i.symbol, name: i.name, sub: i.source }])).values()],
        },
    { title: "Currencies", note: "Spot rates", rows: fxPairs(p) },
    { title: "Commodities", note: `Front-month futures${inLocal}`, rows: p.commodities.map((id) => priced(COMMODITIES[id])) },
    {
      title: p.volatility ? "Crypto & Volatility" : "Crypto",
      note: `Around the clock${inLocal}`,
      rows: [...CRYPTO.map(priced), ...(p.volatility ? [p.volatility] : [])],
    },
  ]

  // FX rates needed to price commodities and crypto locally
  const conversions = groups
    .flatMap((g) => g.rows)
    .filter((r) => r.priced && baseCurrency(r.priced) !== local)
    .map((r) => rateSymbol(baseCurrency(r.priced!), local))

  const symbols = [...groups.flatMap((g) => g.rows.map((r) => r.symbol)), ...conversions, ...(p.sectors?.items.map((s) => s.symbol) ?? [])]
  return { currency: local, groups, symbols: [...new Set(symbols)], sectors: p.sectors ?? null, caps: largeCapsFor(p) }
}

/** Price and change in the market's currency. The change folds in the currency's own move. */
function localize(row: Row, quotes: Record<string, Stock>, local: string) {
  const q = quotes[row.symbol]
  if (!q || !row.priced) return null
  const from = baseCurrency(row.priced)
  const scale = row.priced.currency === "USX" ? 0.01 : 1
  const native = q.price * scale
  if (from === local) return { price: native, prev: q.prevClose * scale, native: null as number | null, from }
  const fx = quotes[rateSymbol(from, local)]
  if (!fx) return null
  return { price: native * fx.price, prev: q.prevClose * scale * fx.prevClose, native, from }
}

const symbolHref = (s: string) => `/symbol/${encodeURIComponent(s)}`
const directionOf = (pct: number): Direction => (pct > 0.005 ? "up" : pct < -0.005 ? "down" : "flat")

/* ───────────────────────── Page ───────────────────────── */

export function MarketsView() {
  const { market, ready } = useMarket()
  const board = useMemo(() => buildBoard(market), [market])
  const isUS = market.id === "us"

  const { quotes, state } = useQuotes(board.symbols, 15_000, { enabled: ready })
  const { quotes: capQuotes, state: capState } = useQuotes(
    board.caps.map((c) => c.symbol),
    15_000,
    { enabled: ready && board.caps.length > 0 },
  )

  // Yahoo's movers screeners only cover US listings
  const [movers, setMovers] = useState<Movers | null>(null)
  const [moversFailed, setMoversFailed] = useState(false)
  usePoll(
    async () => {
      const result = await fetchMovers()
      if (!result) {
        setMoversFailed(true)
        return false
      }
      setMovers(result)
      setMoversFailed(false)
      return !result.stale
    },
    60_000,
    "movers",
    ready && isUS,
  )

  const caps = useMemo(
    () => board.caps.map((c) => ({ ...c, quote: capQuotes[c.symbol] })).filter((c): c is LargeCap & { quote: Stock } => !!c.quote),
    [board.caps, capQuotes],
  )
  const capsFailed = capState === "error" && !caps.length

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageTitle title="Markets" subtitle={`What's moving in ${market.name} · ${market.exchange}`} />
      <MarketBar />

      <section aria-labelledby="cross-asset" className="flex flex-col gap-3">
        <h2 id="cross-asset" className="sr-only">
          {board.groups.map((g) => g.title).join(", ")} for {market.name}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {board.groups.map((g) => (
            <div key={g.title} className="rounded-[22px] bg-surface px-4 pb-2 pt-4">
              <div className="flex items-baseline justify-between gap-2 px-1 pb-2">
                <h3 className="text-[17px] font-semibold">{g.title}</h3>
                <span className="truncate text-[12px] text-label-2">{g.note}</span>
              </div>
              <ul>
                {g.rows.map((row) => (
                  <InstrumentRow key={row.symbol} row={row} quotes={quotes} local={board.currency} failed={state === "error"} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <SectorsSection market={market} board={board} quotes={quotes} caps={caps} capCount={board.caps.length} />

      {isUS ? (
        <MoversSection
          title={`${market.name} Movers`}
          note={movers?.stale ? "Showing last update · Yahoo screener unavailable" : "Yahoo Finance screeners · refreshed every minute"}
          gainers={movers?.gainers}
          losers={movers?.losers}
          active={movers?.active}
          failed={moversFailed && !movers}
          activeLine={(s) => (s.volume ? `${formatCompact(s.volume)} shares` : "")}
        />
      ) : (
        <LargeCapMovers market={market} caps={caps} total={board.caps.length} failed={capsFailed} />
      )}
    </div>
  )
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1 pt-1">
      <div className="flex flex-col">
        <h1 className="display text-[30px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-[14px] text-label-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ───────────────────────── Cross-asset rows ───────────────────────── */

function formatValue(q: Stock, kind: Kind = "price") {
  if (kind === "yield") return `${q.price.toFixed(3)}%`
  if (kind === "fx") {
    const digits = q.price < 20 ? 4 : 2
    return q.price.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
  }
  return formatPrice(q.price)
}

function InstrumentRow({ row, quotes, local, failed }: { row: Row; quotes: Record<string, Stock>; local: string; failed: boolean }) {
  const quote = quotes[row.symbol]
  let value: string
  let sub: string
  let pct: number | null
  let change: string

  if (row.priced) {
    const l = localize(row, quotes, local)
    const per = row.priced.unit === "coin" ? "" : ` / ${row.priced.unit}`
    value = l ? formatMoney(l.price, local) : failed ? "—" : "…"
    sub = l?.native != null ? `${formatMoney(l.native, l.from)}${per}` : row.priced.unit === "coin" ? row.symbol.split("-")[0] : `per ${row.priced.unit}`
    pct = l && l.prev ? (l.price / l.prev - 1) * 100 : null
    change = pct == null ? "—" : formatPercent(pct)
  } else {
    value = quote ? formatValue(quote, row.kind) : failed ? "—" : "…"
    sub = row.sub ?? row.symbol
    pct = quote ? quote.changePercent : null
    // Yields move in percentage points; desks quote that change in basis points
    change = !quote ? "—" : row.kind === "yield" ? `${formatSigned(quote.change * 100, 1)} bp` : formatPercent(quote.changePercent)
  }
  const dir = row.kind === "yield" && quote ? quote.direction : pct == null ? "flat" : directionOf(pct)

  return (
    <li className="border-b border-separator last:border-b-0">
      <Link
        href={symbolHref(row.symbol)}
        className="-mx-2 flex items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 outline-none transition-colors hover:bg-selection/60 focus-visible:ring-2 focus-visible:ring-tint/60"
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] font-medium">{row.name}</span>
          <span className="num truncate text-[12px] text-label-2">{sub}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="num text-[15px] font-semibold">{value}</span>
          <span
            className={cn(
              "num text-[13px] font-medium",
              dir === "up" && "text-up",
              dir === "down" && "text-down",
              dir === "flat" && "text-label-2",
            )}
          >
            {change}
          </span>
        </div>
      </Link>
    </li>
  )
}

/* ───────────────────────── Sectors ───────────────────────── */

function SectorsSection({
  market,
  board,
  quotes,
  caps,
  capCount,
}: {
  market: Market
  board: Board
  quotes: Record<string, Stock>
  caps: (LargeCap & { quote: Stock })[]
  capCount: number
}) {
  // Official sector indexes/ETFs where Yahoo has them, otherwise cap-weighted moves of the largest listings
  const computed = useMemo(() => {
    if (board.sectors) return []
    const by = new Map<string, { weight: number; sum: number; count: number }>()
    for (const c of caps) {
      if (!c.sector) continue
      const w = c.quote.mktCap && c.quote.mktCap > 0 ? c.quote.mktCap : 1
      const s = by.get(c.sector) ?? { weight: 0, sum: 0, count: 0 }
      s.weight += w
      s.sum += w * c.quote.changePercent
      s.count += 1
      by.set(c.sector, s)
    }
    return [...by.entries()].sort((a, b) => b[1].weight - a[1].weight).map(([name, s]) => ({ name, pct: s.sum / s.weight, count: s.count }))
  }, [board.sectors, caps])

  if (!board.sectors && !capCount) return null
  return (
    <section aria-labelledby="sectors" className="rounded-[22px] bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2 px-1 pb-3">
        <h2 id="sectors" className="text-[17px] font-semibold">
          {market.name} Sectors
        </h2>
        <span className="truncate text-[12px] text-label-2">
          {board.sectors ? `${board.sectors.note} · today` : `Cap-weighted from the ${capCount} largest listings · today`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {board.sectors
          ? board.sectors.items.map((s) => (
              <SectorTile key={s.symbol} name={s.name} pct={quotes[s.symbol]?.changePercent ?? null} label={s.symbol} href={symbolHref(s.symbol)} />
            ))
          : computed.length
            ? computed.map((s) => <SectorTile key={s.name} name={s.name} pct={s.pct} label={`${s.count} ${s.count === 1 ? "stock" : "stocks"}`} />)
            : Array.from({ length: 8 }, (_, i) => <div key={i} className="h-[84px] animate-pulse rounded-[16px] bg-fill" />)}
      </div>
    </section>
  )
}

function SectorTile({ name, pct, label, href }: { name: string; pct: number | null; label: string; href?: string }) {
  const has = pct != null
  // Tint strength scales with the size of the move (capped at ±3%); text stays high-contrast
  const strength = has ? Math.min(Math.abs(pct) / 3, 1) * 45 + 8 : 0
  const fill = (pct ?? 0) >= 0 ? "var(--up-fill)" : "var(--down-fill)"
  const body = (
    <>
      <span className="truncate text-[13px] font-medium">{name}</span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-[19px] font-semibold">{has ? formatPercent(pct) : "—"}</span>
        <span className="truncate text-[11px] font-medium text-label-2">{label}</span>
      </div>
    </>
  )
  const className = "flex h-[84px] flex-col justify-between rounded-[16px] p-3"
  const style = { background: has ? `color-mix(in srgb, ${fill} ${strength}%, var(--bg))` : "var(--fill)" }
  const aria = `${name} sector ${has ? formatPercent(pct) : "no data"}`
  return href ? (
    <Link href={href} className={cn(className, "press outline-none focus-visible:ring-2 focus-visible:ring-tint/60")} style={style} aria-label={aria}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style} aria-label={aria} role="group">
      {body}
    </div>
  )
}

/* ───────────────────────── Movers ───────────────────────── */

function LargeCapMovers({ market, caps, total, failed }: { market: Market; caps: (LargeCap & { quote: Stock })[]; total: number; failed: boolean }) {
  const lists = useMemo(() => {
    if (!caps.length) return null
    const stocks = caps.map((c) => c.quote)
    return {
      gainers: stocks.filter((s) => s.direction === "up").sort((a, b) => b.changePercent - a.changePercent),
      losers: stocks.filter((s) => s.direction === "down").sort((a, b) => a.changePercent - b.changePercent),
      // Share counts aren't comparable across price levels, so rank activity by value traded
      active: stocks.filter((s) => s.volume).sort((a, b) => b.price * b.volume! - a.price * a.volume!),
      up: stocks.filter((s) => s.direction === "up").length,
      down: stocks.filter((s) => s.direction === "down").length,
    }
  }, [caps])

  return (
    <MoversSection
      title={`${market.name} Movers`}
      note={lists ? `${lists.up} up · ${lists.down} down among the ${total} largest listings` : `Among the ${total} largest listings`}
      gainers={lists?.gainers}
      losers={lists?.losers}
      active={lists?.active}
      failed={failed}
      activeLine={(s) => (s.volume ? `${formatMoney(s.price * s.volume, s.currency, { compact: true })} traded` : "")}
    />
  )
}

function MoversSection({
  title,
  note,
  gainers,
  losers,
  active,
  failed,
  activeLine,
}: {
  title: string
  note: string
  gainers?: Stock[]
  losers?: Stock[]
  active?: Stock[]
  failed: boolean
  activeLine: (s: Stock) => string
}) {
  return (
    <section aria-labelledby="movers" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 px-1">
        <h2 id="movers" className="text-[22px] font-bold">
          {title}
        </h2>
        <span className="text-[12px] text-label-2">{note}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MoverList title="Top Gainers" list={gainers} failed={failed} empty="No gainers today" />
        <MoverList title="Top Losers" list={losers} failed={failed} empty="No decliners today" />
        <MoverList title="Most Active" list={active} failed={failed} empty="No trading data" line={activeLine} />
      </div>
    </section>
  )
}

// "RELIANCE.NS" → "RELIANCE"; numeric codes like "7203.T" keep their suffix so they stay recognisable
const displaySymbol = (s: string) => (/^\d/.test(s) ? s : s.replace(/\.[A-Z]{1,3}$/, ""))

function MoverList({
  title,
  list,
  failed,
  empty,
  line,
}: {
  title: string
  list?: Stock[]
  failed: boolean
  empty: string
  line?: (s: Stock) => string
}) {
  return (
    <div className="rounded-[22px] bg-surface px-4 pb-2 pt-4">
      <h3 className="px-1 pb-2 text-[17px] font-semibold">{title}</h3>
      {!list ? (
        <p className="px-1 py-8 text-center text-[13px] text-label-2">{failed ? "Movers unavailable right now" : "Loading…"}</p>
      ) : list.length === 0 ? (
        <p className="px-1 py-8 text-center text-[13px] text-label-2">{empty}</p>
      ) : (
        <ul>
          {list.slice(0, 8).map((s) => {
            const extra = line?.(s)
            return (
              <li key={s.symbol} className="border-b border-separator last:border-b-0">
                <Link
                  href={symbolHref(s.symbol)}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 outline-none transition-colors hover:bg-selection/60 focus-visible:ring-2 focus-visible:ring-tint/60"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[15px] font-semibold">{displaySymbol(s.symbol)}</span>
                    <span className="truncate text-[12px] text-label-2">
                      {extra ? `${extra} · ` : ""}
                      {s.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num text-[15px] font-semibold">{formatMoney(s.price, s.currency)}</span>
                    <ChangePill direction={s.direction} className="min-w-[64px]">
                      {formatPercent(s.changePercent)}
                    </ChangePill>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
