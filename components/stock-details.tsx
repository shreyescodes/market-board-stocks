"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Area, Bar, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ChartData, Stock } from "@/lib/stock-types"
import { fetchChart } from "@/lib/stock-data"
import { formatCompact, formatMoney, formatPercent, formatPrice, formatSigned, formatTimeIn } from "@/lib/format"
import { ChangePill, NumericText } from "./liquid-glass"
import { cn } from "@/lib/utils"

interface StockDetailsProps {
  stock: Stock
}

type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL"
type Row = { i: number; t: number; price: number; volume: number | null }

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"]
const RANGE_NAMES: Record<Timeframe, string> = {
  "1D": "1 day",
  "1W": "1 week",
  "1M": "1 month",
  "3M": "3 months",
  "1Y": "1 year",
  ALL: "all time",
}
const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const

const MARKET_STATE: Record<string, string> = {
  REGULAR: "Market open",
  PRE: "Pre-market",
  PREPRE: "Pre-market",
  POST: "After hours",
  POSTPOST: "After hours",
  CLOSED: "Market closed",
}

// Yahoo's exchange names are terse ("NasdaqGS"); show the familiar name
function exchangeLabel(raw?: string | null) {
  if (!raw) return "—"
  if (/^Nasdaq/i.test(raw)) return "Nasdaq"
  if (raw === "NYSEArca") return "NYSE Arca"
  return raw
}

/* Labels in the exchange's own time zone */
function pointLabel(t: number, tf: Timeframe, timeZone: string) {
  const d = new Date(t)
  if (tf === "1D") return d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" })
  if (tf === "1W")
    return d.toLocaleString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  if (tf === "ALL") return d.toLocaleDateString("en-US", { timeZone, month: "short", year: "numeric" })
  return d.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric", year: "numeric" })
}
function tickLabel(t: number, tf: Timeframe, timeZone: string) {
  const d = new Date(t)
  if (tf === "1D") return d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" })
  if (tf === "1W") return d.toLocaleDateString("en-US", { timeZone, weekday: "short" })
  if (tf === "1M" || tf === "3M") return d.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" })
  if (tf === "1Y") return d.toLocaleDateString("en-US", { timeZone, month: "short" })
  return d.toLocaleDateString("en-US", { timeZone, year: "numeric" })
}

export function StockDetails({ stock }: StockDetailsProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D")
  const [chart, setChart] = useState<ChartData | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [hover, setHover] = useState<Row | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // History loads on symbol/range change; the live 1D session also refreshes every minute
  useEffect(() => {
    let active = true
    setChart(null)
    setStatus("loading")
    setHover(null)

    const load = async (refresh: boolean) => {
      const data = await fetchChart(stock.symbol, timeframe)
      if (!active) return
      if (data && data.points.length > 1) {
        setChart(data)
        setStatus("ready")
      } else if (!refresh) {
        setStatus("error") // a failed background refresh keeps the last good chart
      }
    }
    load(false)
    const interval = timeframe === "1D" ? setInterval(() => load(true), 60_000) : undefined
    return () => {
      active = false
      if (interval) clearInterval(interval)
    }
  }, [stock.symbol, timeframe, reloadKey])

  const timeZone = chart?.timeZone ?? stock.timeZone ?? "America/New_York"
  const rows: Row[] = useMemo(
    () => (chart?.points ?? []).map((p, i) => ({ i, t: p.t, price: p.price, volume: p.volume })),
    [chart],
  )

  const base = useMemo(() => {
    // 1D compares against the official previous close from the quote
    if (timeframe === "1D") return stock.prevClose || chart?.previousClose || 0
    return rows[0]?.price ?? stock.prevClose
  }, [timeframe, chart, rows, stock.prevClose])

  const lastPrice = rows.length ? rows[rows.length - 1].price : stock.price
  const periodChange = (timeframe === "1D" ? stock.price : lastPrice) - base
  const periodPct = base ? (periodChange / base) * 100 : 0
  const isPositive = periodChange >= 0
  const chartColor = isPositive ? "var(--up)" : "var(--down)"
  const gradientId = `detail-gradient-${stock.symbol.replace(/[^a-zA-Z0-9]/g, "")}`

  // Header: the live quote, or the point under the pointer
  const shownPrice = hover?.price ?? stock.price
  const shownChange = hover ? hover.price - base : stock.change
  const shownPct = hover ? (base ? ((hover.price - base) / base) * 100 : 0) : stock.changePercent
  const shownDir: "up" | "down" | "flat" = shownChange > 0.005 ? "up" : shownChange < -0.005 ? "down" : "flat"

  const ticks = useMemo(() => {
    if (rows.length < 2) return []
    const n = 5
    return Array.from({ length: n }, (_, k) => Math.round((k * (rows.length - 1)) / (n - 1)))
  }, [rows])
  const maxVolume = useMemo(() => rows.reduce((m, r) => Math.max(m, r.volume ?? 0), 0), [rows])

  const onTabKey = useCallback((e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
    if (!dir && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? TIMEFRAMES.length - 1 : (index + dir + TIMEFRAMES.length) % TIMEFRAMES.length
    setTimeframe(TIMEFRAMES[next])
    tabRefs.current[next]?.focus()
  }, [])

  // During the regular session, a quote timestamp more than a few minutes old means the feed is lagging
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const lagMinutes =
    stock.marketState === "REGULAR" && stock.asOf ? Math.max(0, Math.floor((nowMs - stock.asOf) / 60_000)) : 0

  const stateLabel = stock.marketState ? MARKET_STATE[stock.marketState] ?? null : null
  const showPre = (stock.marketState === "PRE" || stock.marketState === "PREPRE") && stock.prePrice != null
  const showPost =
    (stock.marketState === "POST" || stock.marketState === "POSTPOST" || stock.marketState === "CLOSED") &&
    stock.postPrice != null
  const ext = showPre
    ? { label: "Pre-market", price: stock.prePrice!, change: stock.preChange, pct: stock.preChangePercent, time: stock.preTime }
    : showPost
      ? { label: "After hours", price: stock.postPrice!, change: stock.postChange, pct: stock.postChangePercent, time: stock.postTime }
      : null

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 px-1 pt-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={stock.symbol}
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={spring}
              className="flex flex-col"
            >
              <h2 className="display text-[34px] font-bold leading-none text-foreground">{stock.symbol}</h2>
              <span className="mt-2 truncate text-[15px] text-label-2">{stock.name}</span>
              <span className="mt-0.5 text-[13px] text-label-2">
                {exchangeLabel(stock.exchange)} · {stock.currency ?? "—"}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col sm:items-end">
          <NumericText value={shownPrice} format={formatPrice} className="display text-[38px] font-semibold leading-none text-foreground" />
          <div className="mt-2.5 flex items-center gap-2">
            <ChangePill direction={shownDir}>{formatSigned(shownChange)}</ChangePill>
            <span
              className={cn(
                "num text-[14px] font-semibold",
                shownDir === "up" && "text-up",
                shownDir === "down" && "text-down",
                shownDir === "flat" && "text-label-2",
              )}
            >
              {formatPercent(shownPct)}
            </span>
            <span className="text-[13px] font-medium text-label-2">
              {hover ? pointLabel(hover.t, timeframe, timeZone) : stock.marketState === "REGULAR" ? "Today" : "At close"}
            </span>
          </div>
          {/* Freshness: when this price is from, the session, and any exchange delay */}
          <span className="num mt-1.5 text-[12px] text-label-2">
            As of {formatTimeIn(stock.asOf, stock.timeZone)}
            {stateLabel && ` · ${stateLabel}`}
            {lagMinutes >= 5 && ` · ${lagMinutes} min behind`}
          </span>
          {ext && (
            <span className="num mt-0.5 text-[12px] text-label-2">
              {ext.label} <span className="font-semibold text-foreground">{formatPrice(ext.price)}</span>{" "}
              <span className={cn((ext.change ?? 0) >= 0 ? "text-up" : "text-down")}>
                {formatSigned(ext.change)} ({formatPercent(ext.pct)})
              </span>
              {ext.time ? ` · ${formatTimeIn(ext.time, stock.timeZone)}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Range control */}
      <div className="flex flex-col gap-3 px-1 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="fill relative flex w-full rounded-full p-[3px] sm:w-auto" role="tablist" aria-label="Chart range">
          {TIMEFRAMES.map((tf, index) => {
            const active = timeframe === tf
            return (
              <button
                key={tf}
                ref={(el) => {
                  tabRefs.current[index] = el
                }}
                role="tab"
                aria-selected={active}
                aria-label={RANGE_NAMES[tf]}
                tabIndex={active ? 0 : -1}
                onKeyDown={(e) => onTabKey(e, index)}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "press relative h-[30px] flex-1 rounded-full px-4 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-tint/60 sm:flex-none",
                  active ? "text-foreground" : "text-label-2 hover:text-foreground",
                )}
              >
                {active && <motion.span layoutId="range-lens" transition={spring} className="glass-thumb absolute inset-0 rounded-full" />}
                <span className="relative">{tf}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-label-2">
          <span>{timeframe === "1D" ? "Since prev. close" : `${RANGE_NAMES[timeframe]} return`}</span>
          <span className={cn("num font-semibold", status !== "ready" ? "text-label-2" : isPositive ? "text-up" : "text-down")}>
            {status === "ready" ? formatPercent(periodPct) : "—"}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative mt-4 h-[300px] w-full sm:h-[360px]">
        <AnimatePresence>
          {status === "loading" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center"
            >
              <div className="fill flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium text-label-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-label-2/30 border-t-foreground/70" />
                Loading
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {status === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <span className="text-[15px] font-semibold">No chart data</span>
            <span className="max-w-[320px] text-[13px] text-label-2">
              Yahoo Finance didn&apos;t return prices for {stock.symbol} over {RANGE_NAMES[timeframe]}.
            </span>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="press fill mt-2 rounded-full px-4 py-1.5 text-[13px] font-semibold hover:bg-fill-hover"
            >
              Try Again
            </button>
          </div>
        ) : (
          rows.length > 1 && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                key={`${stock.symbol}-${timeframe}`}
                data={rows}
                margin={{ top: 16, right: 0, left: 0, bottom: 0 }}
                onMouseMove={(s: any) => {
                  const p = s?.activePayload?.[0]?.payload as Row | undefined
                  if (p) setHover((h) => (h?.i === p.i ? h : p))
                }}
                onMouseLeave={() => setHover(null)}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.22} />
                    <stop offset="75%" stopColor={chartColor} stopOpacity={0.03} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="i"
                  type="number"
                  domain={[0, rows.length - 1]}
                  ticks={ticks}
                  interval={0}
                  // Edge labels anchor inward so the first and last times are never dropped
                  tick={({ x, y, payload, index }: { x: number; y: number; payload: { value: number }; index: number }) => (
                    <text
                      x={x}
                      y={y}
                      dy={12}
                      fill="var(--label-2)"
                      fontSize={11}
                      textAnchor={index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle"}
                    >
                      {rows[payload.value] ? tickLabel(rows[payload.value].t, timeframe, timeZone) : ""}
                    </text>
                  )}
                  stroke="var(--label-2)"
                  tickLine={false}
                  axisLine={{ stroke: "var(--separator)" }}
                  tickMargin={8}
                  height={28}
                />
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  domain={["auto", "auto"]}
                  stroke="var(--label-2)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={62}
                  tickFormatter={(v: number) => formatPrice(v)}
                />
                {/* Volume occupies the bottom quarter of the plot */}
                <YAxis yAxisId="volume" hide domain={[0, maxVolume ? maxVolume * 4 : 1]} />
                {timeframe === "1D" && base ? (
                  <ReferenceLine
                    yAxisId="price"
                    y={base}
                    stroke="var(--label-2)"
                    strokeDasharray="2 4"
                    strokeOpacity={0.6}
                    ifOverflow="extendDomain"
                  />
                ) : null}
                <Tooltip
                  content={() => null}
                  cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.35, strokeWidth: 1 }}
                  isAnimationActive={false}
                />
                {maxVolume > 0 && (
                  <Bar yAxisId="volume" dataKey="volume" fill="var(--label-3)" isAnimationActive={false} maxBarSize={6} />
                )}
                <Area
                  yAxisId="price"
                  type="linear"
                  dataKey="price"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  activeDot={{ r: 5, fill: chartColor, stroke: "var(--background)", strokeWidth: 2.5 }}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )
        )}
      </div>

      {/* Fundamentals */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 rounded-[22px] bg-surface px-5 py-2 sm:grid-cols-4">
        <Stat label="Open" value={formatPrice(stock.open)} />
        <Stat label="Volume" value={formatCompact(stock.volume)} />
        <Stat label="52W High" value={formatPrice(stock.fiftyTwoWHigh)} />
        <Stat label="Yield" value={stock.dividendYield ? `${stock.dividendYield.toFixed(2)}%` : "—"} />
        <Stat label="High" value={formatPrice(stock.high)} />
        <Stat label="P/E" value={stock.pe != null ? stock.pe.toFixed(2) : "—"} />
        <Stat label="52W Low" value={formatPrice(stock.fiftyTwoWLow)} />
        <Stat label="EPS" value={formatMoney(stock.eps, stock.currency)} />
        <Stat label="Low" value={formatPrice(stock.low)} />
        <Stat label="Mkt Cap" value={formatMoney(stock.mktCap, stock.currency, { compact: true })} />
        <Stat label="Avg Vol" value={formatCompact(stock.avgVol)} />
        <Stat label="Prev Close" value={formatPrice(stock.prevClose)} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-separator py-3 [&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-last-child(-n+4)]:border-b-0">
      <span className="text-[13px] text-label-2">{label}</span>
      <span className="num text-[13px] font-semibold text-foreground">{value}</span>
    </div>
  )
}
