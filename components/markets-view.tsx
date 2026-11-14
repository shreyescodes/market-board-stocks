"use client"

import { useState } from "react"
import Link from "next/link"
import { MarketBar } from "./market-bar"
import { ChangePill } from "./liquid-glass"
import { useQuotes } from "@/hooks/use-quotes"
import { usePoll } from "@/hooks/use-poll"
import { fetchMovers, type Movers } from "@/lib/stock-data"
import { formatPercent, formatPrice, formatSigned } from "@/lib/format"
import type { Stock } from "@/lib/stock-types"
import { cn } from "@/lib/utils"

type Kind = "yield" | "fx" | "price"
type Instrument = { symbol: string; name: string; sub?: string; kind?: Kind }

const GROUPS: { title: string; note: string; items: Instrument[] }[] = [
  {
    title: "Rates",
    note: "US Treasury yields · change in basis points",
    items: [
      { symbol: "^IRX", name: "13-Week Bill", kind: "yield" },
      { symbol: "^FVX", name: "5-Year Note", kind: "yield" },
      { symbol: "^TNX", name: "10-Year Note", kind: "yield" },
      { symbol: "^TYX", name: "30-Year Bond", kind: "yield" },
    ],
  },
  {
    title: "Currencies",
    note: "Spot rates",
    items: [
      { symbol: "DX-Y.NYB", name: "US Dollar Index", sub: "DXY" },
      { symbol: "EURUSD=X", name: "EUR/USD", kind: "fx" },
      { symbol: "GBPUSD=X", name: "GBP/USD", kind: "fx" },
      { symbol: "JPY=X", name: "USD/JPY", kind: "fx" },
      { symbol: "USDINR=X", name: "USD/INR", kind: "fx" },
      { symbol: "CNY=X", name: "USD/CNY", kind: "fx" },
    ],
  },
  {
    title: "Commodities",
    note: "Front-month futures",
    items: [
      { symbol: "CL=F", name: "WTI Crude", sub: "$/barrel" },
      { symbol: "BZ=F", name: "Brent Crude", sub: "$/barrel" },
      { symbol: "NG=F", name: "Natural Gas", sub: "$/MMBtu" },
      { symbol: "GC=F", name: "Gold", sub: "$/troy oz" },
      { symbol: "SI=F", name: "Silver", sub: "$/troy oz" },
      { symbol: "HG=F", name: "Copper", sub: "$/lb" },
    ],
  },
  {
    title: "Crypto & Volatility",
    note: "Crypto trades around the clock",
    items: [
      { symbol: "BTC-USD", name: "Bitcoin", sub: "USD" },
      { symbol: "ETH-USD", name: "Ethereum", sub: "USD" },
      { symbol: "^VIX", name: "VIX", sub: "S&P 500 implied volatility" },
    ],
  },
]

// The 11 S&P 500 sectors, via their Select Sector SPDR ETFs
const SECTORS = [
  { symbol: "XLK", name: "Technology" },
  { symbol: "XLF", name: "Financials" },
  { symbol: "XLV", name: "Health Care" },
  { symbol: "XLY", name: "Consumer Discretionary" },
  { symbol: "XLC", name: "Communication Services" },
  { symbol: "XLI", name: "Industrials" },
  { symbol: "XLP", name: "Consumer Staples" },
  { symbol: "XLE", name: "Energy" },
  { symbol: "XLU", name: "Utilities" },
  { symbol: "XLRE", name: "Real Estate" },
  { symbol: "XLB", name: "Materials" },
]

const ALL_SYMBOLS = [...GROUPS.flatMap((g) => g.items.map((i) => i.symbol)), ...SECTORS.map((s) => s.symbol)]
const symbolHref = (s: string) => `/symbol/${encodeURIComponent(s)}`

export function MarketsView() {
  const { quotes, state } = useQuotes(ALL_SYMBOLS, 15_000)
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
  )

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageTitle title="Markets" subtitle="A cross-asset view of what's moving" />
      <MarketBar />

      <section aria-labelledby="cross-asset" className="flex flex-col gap-3">
        <h2 id="cross-asset" className="sr-only">
          Rates, currencies, commodities and crypto
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="rounded-[22px] bg-surface px-4 pb-2 pt-4">
              <div className="flex items-baseline justify-between gap-2 px-1 pb-2">
                <h3 className="text-[17px] font-semibold">{g.title}</h3>
                <span className="truncate text-[12px] text-label-2">{g.note}</span>
              </div>
              <ul>
                {g.items.map((item) => (
                  <InstrumentRow key={item.symbol} item={item} quote={quotes[item.symbol]} failed={state === "error"} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="sectors" className="rounded-[22px] bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2 px-1 pb-3">
          <h2 id="sectors" className="text-[17px] font-semibold">
            US Sectors
          </h2>
          <span className="text-[12px] text-label-2">Select Sector SPDR ETFs · today</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {SECTORS.map((s) => (
            <SectorTile key={s.symbol} name={s.name} symbol={s.symbol} quote={quotes[s.symbol]} />
          ))}
        </div>
      </section>

      <section aria-labelledby="movers" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 id="movers" className="text-[22px] font-bold">
            US Movers
          </h2>
          <span className="text-[12px] text-label-2">
            {movers?.stale ? "Showing last update · Yahoo screener unavailable" : "Yahoo Finance screeners · refreshed every minute"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MoverList title="Top Gainers" list={movers?.gainers} failed={moversFailed && !movers} />
          <MoverList title="Top Losers" list={movers?.losers} failed={moversFailed && !movers} />
          <MoverList title="Most Active" list={movers?.active} failed={moversFailed && !movers} showVolume />
        </div>
      </section>
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

function formatValue(q: Stock, kind: Kind = "price") {
  if (kind === "yield") return `${q.price.toFixed(3)}%`
  if (kind === "fx") return q.price.toLocaleString("en-US", { minimumFractionDigits: q.price < 20 ? 4 : 2, maximumFractionDigits: q.price < 20 ? 4 : 2 })
  return formatPrice(q.price)
}

function InstrumentRow({ item, quote, failed }: { item: Instrument; quote?: Stock; failed: boolean }) {
  const dir = quote?.direction ?? "flat"
  // Yields move in percentage points; desks quote that change in basis points
  const change =
    !quote ? "—" : item.kind === "yield" ? `${formatSigned(quote.change * 100, 1)} bp` : formatPercent(quote.changePercent)
  return (
    <li className="border-b border-separator last:border-b-0">
      <Link
        href={symbolHref(item.symbol)}
        className="-mx-2 flex items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 outline-none transition-colors hover:bg-selection/60 focus-visible:ring-2 focus-visible:ring-tint/60"
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] font-medium">{item.name}</span>
          <span className="truncate text-[12px] text-label-2">{item.sub ?? item.symbol}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="num text-[15px] font-semibold">{quote ? formatValue(quote, item.kind) : failed ? "—" : "…"}</span>
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

function SectorTile({ name, symbol, quote }: { name: string; symbol: string; quote?: Stock }) {
  const pct = quote?.changePercent ?? 0
  // Tint strength scales with the size of the move (capped at ±3%); text stays high-contrast
  const strength = quote ? Math.min(Math.abs(pct) / 3, 1) * 45 + 8 : 0
  const fill = pct >= 0 ? "var(--up-fill)" : "var(--down-fill)"
  return (
    <Link
      href={symbolHref(symbol)}
      className="press flex h-[84px] flex-col justify-between rounded-[16px] p-3 outline-none focus-visible:ring-2 focus-visible:ring-tint/60"
      style={{ background: quote ? `color-mix(in srgb, ${fill} ${strength}%, var(--bg))` : "var(--fill)" }}
      aria-label={`${name} sector (${symbol}) ${quote ? formatPercent(pct) : "no data"}`}
    >
      <span className="truncate text-[13px] font-medium">{name}</span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-[19px] font-semibold">{quote ? formatPercent(pct) : "—"}</span>
        <span className="text-[11px] font-medium text-label-2">{symbol}</span>
      </div>
    </Link>
  )
}

function MoverList({ title, list, failed, showVolume }: { title: string; list?: Stock[]; failed: boolean; showVolume?: boolean }) {
  return (
    <div className="rounded-[22px] bg-surface px-4 pb-2 pt-4">
      <h3 className="px-1 pb-2 text-[17px] font-semibold">{title}</h3>
      {!list ? (
        <p className="px-1 py-8 text-center text-[13px] text-label-2">{failed ? "Movers unavailable right now" : "Loading…"}</p>
      ) : list.length === 0 ? (
        <p className="px-1 py-8 text-center text-[13px] text-label-2">No data</p>
      ) : (
        <ul>
          {list.slice(0, 8).map((s) => (
            <li key={s.symbol} className="border-b border-separator last:border-b-0">
              <Link
                href={symbolHref(s.symbol)}
                className="-mx-2 flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 outline-none transition-colors hover:bg-selection/60 focus-visible:ring-2 focus-visible:ring-tint/60"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold">{s.symbol}</span>
                  <span className="truncate text-[12px] text-label-2">
                    {showVolume && s.volume ? `${Intl.NumberFormat("en-US", { notation: "compact" }).format(s.volume)} shares · ` : ""}
                    {s.name}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="num text-[15px] font-semibold">{formatPrice(s.price)}</span>
                  <ChangePill direction={s.direction} className="min-w-[64px]">
                    {formatPercent(s.changePercent)}
                  </ChangePill>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
