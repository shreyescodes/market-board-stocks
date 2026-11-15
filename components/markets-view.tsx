"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, ListFilter } from "lucide-react"
import { useMarket } from "./market-context"
import { useWorkspace } from "./workspace"
import { IndexesSheet, usePinnedIndexes } from "./indexes-sheet"
import { Segmented } from "./segmented"
import { Sparkline } from "./sparkline"
import { useQuotes } from "@/hooks/use-quotes"
import { usePoll } from "@/hooks/use-poll"
import { useSparks } from "@/hooks/use-sparks"
import { useNow } from "@/hooks/use-browser"
import { fetchChart, fetchMovers, type Movers } from "@/lib/stock-data"
import { displaySymbol, formatMoney, formatPercent, formatPrice, formatSigned, shortName } from "@/lib/format"
import { indexMeta, indexesFor } from "@/lib/indices"
import { getMarketStatus, sessionLabels, type Market } from "@/lib/markets"
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
type TabId = "rates" | "fx" | "commodities" | "crypto"
type Tab = { id: TabId; label: string; note: string; rows: Row[] }
type Board = {
  currency: string
  tabs: Tab[]
  symbols: string[]
  sectors: { note: string; items: { symbol: string; name: string }[] } | null
  caps: LargeCap[]
  volatility: Instrument | null
}

const baseCurrency = (c: Commodity) => (c.currency === "USX" ? "USD" : c.currency)

function buildBoard(market: Market): Board {
  const p = profileFor(market.id)
  const local = p.currency
  const priced = (c: Commodity): Row => ({ symbol: c.symbol, name: c.name, priced: c })
  const inLocal = local === "USD" ? "" : ` · in ${local}`

  const tabs: Tab[] = [
    ...(p.rates ? [{ id: "rates" as const, label: "Rates", note: "Treasury yields · change in basis points", rows: p.rates }] : []),
    { id: "fx", label: "Currencies", note: "Spot rates", rows: fxPairs(p) },
    { id: "commodities", label: "Commodities", note: `Front-month futures${inLocal}`, rows: p.commodities.map((id) => priced(COMMODITIES[id])) },
    { id: "crypto", label: "Crypto", note: `Trades around the clock${inLocal}`, rows: CRYPTO.map(priced) },
  ]

  // FX rates needed to price commodities and crypto locally
  const conversions = tabs
    .flatMap((t) => t.rows)
    .filter((r) => r.priced && baseCurrency(r.priced) !== local)
    .map((r) => rateSymbol(baseCurrency(r.priced!), local))

  const symbols = [
    ...tabs.flatMap((t) => t.rows.map((r) => r.symbol)),
    ...conversions,
    ...(p.sectors?.items.map((s) => s.symbol) ?? []),
    ...indexesFor(market.id).map((i) => i.symbol),
    ...(p.volatility ? [p.volatility.symbol] : []),
  ]
  return { currency: local, tabs, symbols: [...new Set(symbols)], sectors: p.sectors ?? null, caps: largeCapsFor(p), volatility: p.volatility ?? null }
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
const toneOf = (d?: Direction | null) => (d === "up" ? "text-up" : d === "down" ? "text-down" : "text-label-2")

/* ───────────────────────── Page ───────────────────────── */

export function MarketsView() {
  const { market, ready } = useMarket()
  const board = useMemo(() => buildBoard(market), [market])
  const isUS = market.id === "us"
  const { pinned, toggle } = usePinnedIndexes()
  const [indexesOpen, setIndexesOpen] = useState(false)

  const { quotes, state } = useQuotes(board.symbols, 15_000, { enabled: ready })
  const { quotes: capQuotes, state: capState } = useQuotes(
    board.caps.map((c) => c.symbol),
    15_000,
    { enabled: ready && board.caps.length > 0, report: false },
  )
  const caps = useMemo(
    () => board.caps.map((c) => ({ ...c, quote: capQuotes[c.symbol] })).filter((c): c is LargeCap & { quote: Stock } => !!c.quote),
    [board.caps, capQuotes],
  )

  // Yahoo's movers screeners only cover US listings; elsewhere movers come from the largest listings
  const [screened, setScreened] = useState<Movers | null>(null)
  const [screenFailed, setScreenFailed] = useState(false)
  usePoll(
    async () => {
      const result = await fetchMovers()
      if (!result) {
        setScreenFailed(true)
        return false
      }
      setScreened(result)
      setScreenFailed(false)
      return !result.stale
    },
    60_000,
    "movers",
    ready && isUS,
  )

  return (
    <div className="flex flex-col gap-5 pb-4">
      <MarketHeader
        market={market}
        currency={board.currency}
        quotes={quotes}
        pinned={pinned}
        volatility={board.volatility}
        caps={caps}
        capCount={board.caps.length}
        failed={state === "error"}
        onIndexes={() => setIndexesOpen(true)}
      />

      <div className="flex items-baseline justify-between px-1 pt-2">
        <h2 className="display text-[22px] font-bold">What&apos;s moving</h2>
      </div>
      <div className="flex flex-wrap items-stretch gap-4">
        <SectorsCard board={board} quotes={quotes} caps={caps} />
        <MoversCard
          market={market}
          screened={isUS ? screened : null}
          caps={caps}
          capCount={board.caps.length}
          failed={isUS ? screenFailed && !screened : capState === "error" && !caps.length}
        />
      </div>

      <WatchlistStrip />

      <ContextCard board={board} quotes={quotes} failed={state === "error"} />

      <IndexesSheet open={indexesOpen} onClose={() => setIndexesOpen(false)} quotes={quotes} pinned={pinned} onToggle={toggle} />
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

/* ───────────────────────── Header: session, indexes, breadth ───────────────────────── */

function MarketHeader({
  market,
  currency,
  quotes,
  pinned,
  volatility,
  caps,
  capCount,
  failed,
  onIndexes,
}: {
  market: Market
  currency: string
  quotes: Record<string, Stock>
  pinned: string[]
  volatility: Instrument | null
  caps: (LargeCap & { quote: Stock })[]
  capCount: number
  failed: boolean
  onIndexes: () => void
}) {
  const { liveFor, ready } = useMarket()
  const now = useNow()
  const status = now ? getMarketStatus(market, now, liveFor(market.id)) : null
  const labels = sessionLabels(market)
  const main = pinned[0]
  const mainQ = quotes[main]
  const mainName = indexMeta(market.id, main)?.name ?? main

  // The main index's session, refreshed every minute
  const [intraday, setIntraday] = useState<{ symbol: string; points: number[] } | null>(null)
  usePoll(
    async () => {
      const chart = await fetchChart(main, "1D")
      if (!chart) return false
      setIntraday({ symbol: main, points: chart.points.map((p) => p.price) })
      return true
    },
    60_000,
    `intraday:${main}`,
    ready && !!main,
  )
  const points = intraday?.symbol === main ? intraday.points : []

  const side = [
    ...pinned.slice(1).map((s) => ({ symbol: s, name: indexMeta(market.id, s)?.name ?? s })),
    ...(volatility && !pinned.includes(volatility.symbol) ? [{ symbol: volatility.symbol, name: volatility.name }] : []),
  ]

  const asOf = mainQ?.asOf
    ? new Date(mainQ.asOf).toLocaleString("en-US", {
        timeZone: market.timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null

  const up = caps.filter((c) => c.quote.direction === "up").length
  const down = caps.filter((c) => c.quote.direction === "down").length
  const flat = caps.length - up - down
  const sessionOn = status && ["open", "pre", "post", "lunch"].includes(status.state)

  return (
    <section aria-labelledby="market-name" className="flex flex-col gap-5 rounded-[24px] bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-stretch gap-x-7 gap-y-5">
        {/* Market and session */}
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <h1 id="market-name" className="display text-[32px] font-bold leading-tight">
            {market.name}
          </h1>
          <p className="text-[14px] text-label-2">
            {market.exchange} · {market.city}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-[0.03em]"
              style={{ background: sessionOn ? "var(--up-soft)" : "var(--fill)", color: sessionOn ? status?.color : "var(--label-2)" }}
            >
              {status?.label ?? "…"}
            </span>
            <span className="num text-[14px]">{status?.detail}</span>
          </div>
          {status?.holiday && <p className="text-[13px] text-label-2">{status.holiday}</p>}
          <div className="mt-3" aria-hidden>
            <div className="h-1 overflow-hidden rounded-full bg-fill">
              <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${(sessionOn ? (status?.progress ?? 0) : 0) * 100}%`, background: status?.color }} />
            </div>
            <div className="num mt-1.5 flex justify-between text-[11px] text-label-2">
              <span>{labels.pre ? `${labels.pre} pre` : labels.open}</span>
              {labels.pre && <span>{labels.open}</span>}
              <span>{labels.close} close</span>
            </div>
          </div>
          {asOf && <p className="mt-auto pt-3 text-[12px] text-label-2">As of {asOf}</p>}
        </div>

        {/* Main index with its session */}
        <div className="flex min-w-[300px] flex-[2] flex-wrap items-stretch gap-5 border-separator md:border-x md:px-6">
          <div className="flex min-w-[180px] flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-label-2">{mainName}</span>
            {mainQ ? (
              <>
                <span className="num display text-[36px] font-bold leading-tight">{formatPrice(mainQ.price, currency)}</span>
                <span className={cn("num text-[15px] font-semibold", toneOf(mainQ.direction))}>
                  {formatSigned(mainQ.change, 2, currency)}  {formatPercent(mainQ.changePercent)}
                </span>
                {mainQ.low != null && mainQ.high != null && (
                  <span className="num mt-2 text-[12px] text-label-2">
                    Day range {formatPrice(mainQ.low, currency)} – {formatPrice(mainQ.high, currency)}
                  </span>
                )}
                <span className="num text-[12px] text-label-2">Prev close {formatPrice(mainQ.prevClose, currency)}</span>
              </>
            ) : failed ? (
              <span className="mt-2 text-[14px] text-label-2">Unavailable</span>
            ) : (
              <>
                <span className="mt-2 h-8 w-40 animate-pulse rounded-full bg-fill" />
                <span className="mt-2 h-4 w-28 animate-pulse rounded-full bg-fill" />
              </>
            )}
          </div>
          <figure className="m-0 flex min-w-[200px] flex-1 flex-col justify-center gap-1.5">
            <Sparkline points={points} baseline={mainQ?.prevClose} width={240} height={96} area label={`${mainName} today against the previous close`} />
            <figcaption className="num flex justify-between text-[11px] text-label-2">
              <span>{labels.open}</span>
              <span>Dashed: previous close</span>
              <span>{labels.close}</span>
            </figcaption>
          </figure>
        </div>

        {/* Other pinned indexes and the volatility index */}
        <div className="flex min-w-[200px] flex-1 flex-col justify-between gap-3">
          {side.map(({ symbol, name }) => {
            const q = quotes[symbol]
            return (
              <Link key={symbol} href={symbolHref(symbol)} className="flex items-baseline justify-between gap-3 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-tint/60">
                <span className="text-[13px] text-label-2">{name}</span>
                <span className="num text-right">
                  <span className="block text-[16px] font-semibold">{q ? formatPrice(q.price, currency) : "…"}</span>
                  <span className={cn("block text-[13px] font-semibold", toneOf(q?.direction))}>{q ? formatPercent(q.changePercent) : ""}</span>
                </span>
              </Link>
            )
          })}
          <button
            onClick={onIndexes}
            className="press flex items-center gap-1.5 self-start rounded-full text-[13px] font-semibold text-tint outline-none focus-visible:ring-2 focus-visible:ring-tint/60"
          >
            <ListFilter className="h-4 w-4" aria-hidden /> All {new Set(indexesFor(market.id).map((i) => i.symbol)).size} indexes
          </button>
        </div>
      </div>

      {/* Breadth: is it a good day for the market as a whole? */}
      {capCount > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-separator pt-4">
          <span className="text-[13px] font-semibold">Breadth</span>
          <div
            role="img"
            aria-label={caps.length ? `${up} advancing, ${flat} unchanged, ${down} declining` : "Loading breadth"}
            className="flex h-2 min-w-[200px] flex-1 gap-[3px]"
          >
            {caps.length ? (
              <>
                {up > 0 && <span className="rounded-full bg-up" style={{ flex: up }} />}
                {flat > 0 && <span className="rounded-full bg-label-3" style={{ flex: flat }} />}
                {down > 0 && <span className="rounded-full bg-down" style={{ flex: down }} />}
              </>
            ) : (
              <span className="flex-1 animate-pulse rounded-full bg-fill" />
            )}
          </div>
          <span className="num text-[13px]">
            <span className="font-semibold text-up">{up} up</span> · {flat} flat · <span className="font-semibold text-down">{down} down</span>
          </span>
          <span className="text-[12px] text-label-2">
            {capCount} largest {market.exchange} listings
          </span>
        </div>
      )}
    </section>
  )
}

/* ───────────────────────── Sectors ───────────────────────── */

function SectorsCard({ board, quotes, caps }: { board: Board; quotes: Record<string, Stock>; caps: (LargeCap & { quote: Stock })[] }) {
  const tiles = useMemo(() => {
    let list: { key: string; name: string; pct: number | null; href?: string; label: string }[]
    if (board.sectors) {
      list = board.sectors.items.map((s) => ({ key: s.symbol, name: s.name, pct: quotes[s.symbol]?.changePercent ?? null, href: symbolHref(s.symbol), label: s.symbol }))
    } else {
      // Cap-weighted moves of the largest listings, where Yahoo has no sector indexes
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
      list = [...by.entries()].map(([name, s]) => ({ key: name, name, pct: s.sum / s.weight, label: `${s.count} ${s.count === 1 ? "stock" : "stocks"}` }))
    }
    // Best to worst, so the story of the day reads left to right
    return list.sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity))
  }, [board.sectors, quotes, caps])

  return (
    <section aria-labelledby="sectors" className="flex min-w-0 flex-[6_1_440px] flex-col gap-3.5 rounded-[22px] bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="sectors" className="text-[17px] font-semibold">
          Sectors
        </h3>
        <span className="text-[12px] text-label-2">{board.sectors ? `${board.sectors.note} · best to worst` : "Cap-weighted from the largest listings · best to worst"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {tiles.length
          ? tiles.map(({ key, ...t }) => <SectorTile key={key} {...t} />)
          : Array.from({ length: 8 }, (_, i) => <div key={i} className="h-[74px] animate-pulse rounded-[14px] bg-fill" />)}
      </div>
    </section>
  )
}

function SectorTile({ name, pct, label, href }: { name: string; pct: number | null; label: string; href?: string }) {
  const has = pct != null
  // Tint strength scales with the size of the move (capped at ±3%); text stays high-contrast
  const strength = has ? Math.min(Math.abs(pct) / 3, 1) * 42 + 8 : 0
  const fill = (pct ?? 0) >= 0 ? "var(--up-fill)" : "var(--down-fill)"
  const style = { background: has ? `color-mix(in srgb, ${fill} ${strength}%, var(--surface))` : "var(--fill)" }
  const body = (
    <>
      <span className="truncate text-[13px] font-medium">{name}</span>
      <span className="flex items-baseline justify-between gap-2">
        <span className="num text-[19px] font-bold">{has ? formatPercent(pct) : "—"}</span>
        <span className="truncate text-[11px] text-label-2" title={label}>
          {href ? "" : label}
        </span>
      </span>
    </>
  )
  const className = "flex h-[74px] flex-col justify-between rounded-[14px] px-3 py-2.5"
  return href ? (
    <Link href={href} title={label} className={cn(className, "press outline-none focus-visible:ring-2 focus-visible:ring-tint/60")} style={style} aria-label={`${name} ${has ? formatPercent(pct) : "no data"}`}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style} role="group" aria-label={`${name} ${has ? formatPercent(pct) : "no data"}`}>
      {body}
    </div>
  )
}

/* ───────────────────────── Movers ───────────────────────── */

type MoverTab = "gainers" | "losers" | "active"

function MoversCard({
  market,
  screened,
  caps,
  capCount,
  failed,
}: {
  market: Market
  screened: Movers | null
  caps: (LargeCap & { quote: Stock })[]
  capCount: number
  failed: boolean
}) {
  const [tab, setTab] = useState<MoverTab>("gainers")
  const lists = useMemo(() => {
    if (screened) return { gainers: screened.gainers, losers: screened.losers, active: screened.active }
    if (!caps.length) return null
    const stocks = caps.map((c) => c.quote)
    return {
      gainers: stocks.filter((s) => s.direction === "up").sort((a, b) => b.changePercent - a.changePercent),
      losers: stocks.filter((s) => s.direction === "down").sort((a, b) => a.changePercent - b.changePercent),
      // Share counts aren't comparable across price levels, so rank activity by value traded
      active: stocks.filter((s) => s.volume).sort((a, b) => b.price * b.volume! - a.price * a.volume!),
    }
  }, [screened, caps])
  const list = lists?.[tab]

  return (
    <section aria-labelledby="movers" className="flex min-w-0 flex-[5_1_380px] flex-col gap-3 rounded-[22px] bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="movers" className="text-[17px] font-semibold">
          Movers
        </h3>
        <Segmented
          label="Movers list"
          value={tab}
          onChange={setTab}
          options={[
            { value: "gainers", label: "Gainers" },
            { value: "losers", label: "Losers" },
            { value: "active", label: "Most active" },
          ]}
        />
      </div>
      {!list ? (
        <p className="py-10 text-center text-[13px] text-label-2">{failed ? "Movers unavailable right now" : "Loading…"}</p>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-label-2">{tab === "gainers" ? "No gainers today" : tab === "losers" ? "No decliners today" : "No trading data"}</p>
      ) : (
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="text-[12px] text-label-2">
              <th scope="col" className="pb-2 text-left font-semibold">Company</th>
              <th scope="col" className="pb-2 text-right font-semibold">Last</th>
              <th scope="col" className="hidden pb-2 text-right font-semibold sm:table-cell">Value traded</th>
              <th scope="col" className="pb-2 text-right font-semibold">Change</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 6).map((s) => (
              <tr key={s.symbol} className="border-t border-separator">
                <td className="max-w-0 py-2.5 pr-3">
                  <Link href={symbolHref(s.symbol)} className="block rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-tint/60">
                    <span className="block truncate font-semibold">{shortName(s.name)}</span>
                    <span className="block truncate text-[12px] text-label-2">{displaySymbol(s.symbol)}</span>
                  </Link>
                </td>
                <td className="num py-2.5 text-right">{formatMoney(s.price, s.currency)}</td>
                <td className="num hidden py-2.5 text-right text-label-2 sm:table-cell">{s.volume ? formatMoney(s.price * s.volume, s.currency, { compact: true }) : "—"}</td>
                <td className="py-2.5 pl-3 text-right">
                  <span
                    className={cn(
                      "num inline-block min-w-[66px] rounded-[8px] px-2 py-0.5 text-right text-[13px] font-semibold",
                      s.direction === "up" ? "bg-up-soft text-up" : s.direction === "down" ? "bg-down-soft text-down" : "bg-fill text-label-2",
                    )}
                  >
                    {formatPercent(s.changePercent)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-auto text-[12px] text-label-2">
        {screened ? "Yahoo Finance screeners · refreshed every minute" : `Ranked among the ${capCount} largest ${market.exchange} listings`}
      </p>
    </section>
  )
}

/* ───────────────────────── Your watchlist, at a glance ───────────────────────── */

function WatchlistStrip() {
  const { activeWatchlist, ready } = useWorkspace()
  const symbols = useMemo(() => activeWatchlist?.symbols.slice(0, 6) ?? [], [activeWatchlist])
  const { quotes } = useQuotes(symbols, 15_000, { enabled: ready && symbols.length > 0, report: false })
  const sparks = useSparks(symbols, ready)
  if (!activeWatchlist || !symbols.length) return null
  return (
    <section aria-labelledby="watchlist-strip" className="flex flex-col gap-3 rounded-[22px] bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="watchlist-strip" className="text-[17px] font-semibold">
          {activeWatchlist.name}
        </h2>
        <Link href="/watchlists" className="flex items-center gap-0.5 text-[13px] font-semibold text-tint outline-none focus-visible:ring-2 focus-visible:ring-tint/60">
          Open <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="hide-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 md:grid md:grid-cols-3 md:overflow-visible xl:grid-cols-6">
        {symbols.map((s) => {
          const q = quotes[s]
          const spark = sparks[s]
          return (
            <Link
              key={s}
              href={symbolHref(s)}
              className="press flex min-w-[140px] flex-col gap-2 rounded-[14px] bg-surface-2 p-3 outline-none focus-visible:ring-2 focus-visible:ring-tint/60"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[14px] font-semibold">{q ? shortName(q.name) : displaySymbol(s)}</span>
                <span className="shrink-0 text-[11px] text-label-2">{displaySymbol(s)}</span>
              </span>
              <Sparkline points={spark?.points ?? []} baseline={spark?.previousClose ?? q?.prevClose} height={26} />
              <span className="num flex justify-between text-[13px]">
                <span>{q ? formatMoney(q.price, q.currency) : "…"}</span>
                <span className={cn("font-semibold", toneOf(q?.direction))}>{q ? formatPercent(q.changePercent) : ""}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/* ───────────────────────── Around the market: one tabbed card ───────────────────────── */

function formatValue(q: Stock, kind: Kind = "price") {
  if (kind === "yield") return `${q.price.toFixed(3)}%`
  if (kind === "fx") {
    const digits = q.price < 20 ? 4 : 2
    return q.price.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
  }
  return formatPrice(q.price)
}

function ContextCard({ board, quotes, failed }: { board: Board; quotes: Record<string, Stock>; failed: boolean }) {
  const [picked, setPicked] = useState<TabId>("commodities")
  const tab = board.tabs.find((t) => t.id === picked) ?? board.tabs[0]
  const local = board.currency
  const usdRate = local !== "USD" ? quotes[rateSymbol("USD", local)] : undefined
  const converted = tab.rows.some((r) => r.priced && baseCurrency(r.priced) !== local)

  return (
    <section aria-labelledby="context" className="flex flex-col gap-3 rounded-[22px] bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="context" className="text-[17px] font-semibold">
          Around the market
        </h2>
        <Segmented label="Context" value={tab.id} onChange={setPicked} options={board.tabs.map((t) => ({ value: t.id, label: t.label }))} />
      </div>
      <p className="-mt-1 text-[12px] text-label-2">{tab.note}</p>
      <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        {tab.rows.map((row) => (
          <ContextRow key={row.symbol} row={row} quotes={quotes} local={local} failed={failed} />
        ))}
      </ul>
      {converted && usdRate && (
        <p className="text-[12px] text-label-2">
          Converted at USD/{local} {formatValue(usdRate, "fx")}. Changes include the {local}&apos;s own move ({formatPercent(-usdRate.changePercent)} against the dollar today).
        </p>
      )}
    </section>
  )
}

function ContextRow({ row, quotes, local, failed }: { row: Row; quotes: Record<string, Stock>; local: string; failed: boolean }) {
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
    change = pct == null ? "" : formatPercent(pct)
  } else {
    value = quote ? formatValue(quote, row.kind) : failed ? "—" : "…"
    sub = row.sub ?? (row.kind === "fx" ? "Spot" : "")
    pct = quote ? quote.changePercent : null
    // Yields move in percentage points; desks quote that change in basis points
    change = !quote ? "" : row.kind === "yield" ? `${formatSigned(quote.change * 100, 1)} bp` : formatPercent(quote.changePercent)
  }
  const dir = row.kind === "yield" && quote ? quote.direction : pct == null ? "flat" : directionOf(pct)

  return (
    <li className="border-t border-separator">
      <Link
        href={symbolHref(row.symbol)}
        className="-mx-2 flex items-center justify-between gap-3 rounded-[12px] px-2 py-2.5 outline-none transition-colors hover:bg-selection/60 focus-visible:ring-2 focus-visible:ring-tint/60"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold">{row.name}</span>
          {sub && <span className="num truncate text-[12px] text-label-2">{sub}</span>}
        </span>
        <span className="num flex shrink-0 flex-col items-end">
          <span className="text-[15px] font-semibold">{value}</span>
          <span className={cn("text-[13px] font-semibold", toneOf(dir))}>{change}</span>
        </span>
      </Link>
    </li>
  )
}
