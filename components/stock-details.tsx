"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { Stock } from "@/lib/stock-types"
import { fetchRealChart } from "@/lib/stock-data"
import { ChangePill, NumericText } from "./liquid-glass"
import { cn } from "@/lib/utils"

interface StockDetailsProps {
  stock: Stock
}

type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL"
type Point = { date: string; price: number }

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"]
const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const

// Offline fallback curve when the chart API is unavailable
function generateFallbackChart(symbol: string, timeframe: Timeframe, currentPrice: number): Point[] {
  const cfg: Record<Timeframe, [number, number]> = {
    "1D": [24, 0.005],
    "1W": [7, 0.015],
    "1M": [30, 0.025],
    "3M": [60, 0.05],
    "1Y": [52, 0.12],
    ALL: [100, 0.22],
  }
  const [count, vol] = cfg[timeframe]
  let seed = 7
  for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) >>> 0
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  // Seeded random walk backwards from the current price (offline fallback only)
  const step = vol / Math.sqrt(count)
  const data: Point[] = []
  let price = currentPrice
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now)
    if (timeframe === "1D") d.setHours(now.getHours() - i)
    else if (timeframe === "1Y") d.setDate(now.getDate() - i * 7)
    else if (timeframe === "ALL") d.setDate(now.getDate() - i * 30)
    else d.setDate(now.getDate() - i)
    const label =
      timeframe === "1D"
        ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: timeframe === "ALL" ? "numeric" : undefined })
    data.unshift({ date: label, price: Number(price.toFixed(2)) })
    const shock = (rand() + rand() + rand() - 1.5) * 2 * step
    price = Math.max(0.01, price * (1 - shock))
  }
  if (data.length) data[data.length - 1].price = Number(currentPrice.toFixed(2))
  return data
}

const fmtPrice = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCompact = (val: number | null | undefined, currency = false) =>
  val == null || val === 0
    ? "—"
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
        ...(currency ? { style: "currency", currency: "USD" } : {}),
      }).format(val)
const fmtNum = (val: number | null | undefined, digits = 2) => (val == null ? "—" : val.toFixed(digits))

export function StockDetails({ stock }: StockDetailsProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D")
  const [chartData, setChartData] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<Point | null>(null)
  const priceRef = useRef(stock.price)
  priceRef.current = stock.price

  // Load history when the symbol or range changes (not on every price tick)
  useEffect(() => {
    let active = true
    setLoading(true)
    setHover(null)
    fetchRealChart(stock.symbol, timeframe).then((data) => {
      if (!active) return
      setChartData(data && data.length > 1 ? data : generateFallbackChart(stock.symbol, timeframe, priceRef.current))
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [stock.symbol, timeframe])

  const base = useMemo(() => {
    if (timeframe === "1D" && stock.prevClose) return stock.prevClose
    return chartData[0]?.price ?? stock.prevClose
  }, [timeframe, chartData, stock.prevClose])

  const lastPrice = chartData[chartData.length - 1]?.price ?? stock.price
  const periodChange = (timeframe === "1D" ? stock.price : lastPrice) - base
  const periodPct = base ? (periodChange / base) * 100 : 0
  const isPositive = periodChange >= 0
  const chartColor = isPositive ? "var(--up)" : "var(--down)"
  const gradientId = `detail-gradient-${stock.symbol.replace(/[^a-zA-Z0-9]/g, "")}`

  // Header values: live quote, or the scrubbed point
  const shownPrice = hover?.price ?? stock.price
  const shownChange = hover ? hover.price - base : stock.change
  const shownPct = hover ? (base ? ((hover.price - base) / base) * 100 : 0) : stock.changePercent
  const shownDir: "up" | "down" | "flat" = shownChange > 0.005 ? "up" : shownChange < -0.005 ? "down" : "flat"

  const exchange = stock.exchange ?? "—"
  const currency = stock.currency ?? "USD"

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
              <span className="mt-0.5 text-[13px] text-label-3">
                {exchange} · {currency}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col sm:items-end">
          <NumericText
            value={shownPrice}
            format={fmtPrice}
            className="display text-[38px] font-semibold leading-none text-foreground"
          />
          <div className="mt-2.5 flex items-center gap-2">
            <ChangePill direction={shownDir}>
              {shownChange >= 0 ? "+" : ""}
              {shownChange.toFixed(2)}
            </ChangePill>
            <span
              className={cn(
                "num text-[14px] font-semibold",
                shownDir === "up" && "text-up",
                shownDir === "down" && "text-down",
                shownDir === "flat" && "text-muted-foreground",
              )}
            >
              {shownPct >= 0 ? "+" : ""}
              {shownPct.toFixed(2)}%
            </span>
            <span className="text-[13px] font-medium text-muted-foreground">{hover ? hover.date : "Today"}</span>
          </div>
        </div>
      </div>

      {/* Segmented control */}
      <div className="flex flex-col gap-3 px-1 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="fill relative flex w-full rounded-full p-[3px] sm:w-auto" role="tablist" aria-label="Chart range">
          {TIMEFRAMES.map((tf) => {
            const active = timeframe === tf
            return (
              <button
                key={tf}
                role="tab"
                aria-selected={active}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "press relative h-[30px] flex-1 rounded-full px-4 text-[13px] font-semibold sm:flex-none",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span layoutId="range-lens" transition={spring} className="glass-thumb absolute inset-0 rounded-full" />
                )}
                <span className="relative">{tf}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <span>{timeframe === "1D" ? "Since prev. close" : `${timeframe} return`}</span>
          <span className={cn("num font-semibold", isPositive ? "text-up" : "text-down")}>
            {periodPct >= 0 ? "+" : ""}
            {periodPct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative mt-4 h-[300px] w-full sm:h-[360px]">
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center"
            >
              <div className="fill flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium text-muted-foreground">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground/70" />
                Loading
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="h-full w-full"
          animate={{ opacity: loading ? 0.35 : 1, filter: loading ? "blur(4px)" : "blur(0px)" }}
          transition={{ duration: 0.35 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              key={`${stock.symbol}-${timeframe}`}
              data={chartData}
              margin={{ top: 16, right: 0, left: 0, bottom: 4 }}
              onMouseMove={(s: any) => {
                const p = s?.activePayload?.[0]?.payload as Point | undefined
                if (p) setHover((h) => (h?.date === p.date && h.price === p.price ? h : p))
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
              <XAxis dataKey="date" hide />
              <YAxis
                orientation="right"
                domain={["auto", "auto"]}
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={58}
                tickFormatter={(v: number) => (v >= 1000 ? v.toFixed(0) : v.toFixed(2))}
              />
              {timeframe === "1D" && stock.prevClose ? (
                <ReferenceLine y={stock.prevClose} stroke="var(--muted-foreground)" strokeDasharray="2 4" strokeOpacity={0.6} />
              ) : null}
              <Tooltip
                content={() => null}
                cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.35, strokeWidth: 1 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2.2}
                fill={`url(#${gradientId})`}
                activeDot={{ r: 5, fill: chartColor, stroke: "var(--background)", strokeWidth: 2.5 }}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Fundamentals */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 rounded-[22px] bg-surface px-5 py-2 sm:grid-cols-4">
        <Stat label="Open" value={fmtNum(stock.open)} />
        <Stat label="Volume" value={fmtCompact(stock.volume)} />
        <Stat label="52W High" value={fmtNum(stock.fiftyTwoWHigh)} />
        <Stat label="Yield" value={stock.dividendYield ? `${stock.dividendYield.toFixed(2)}%` : "—"} />
        <Stat label="High" value={fmtNum(stock.high)} />
        <Stat label="P/E" value={fmtNum(stock.pe)} />
        <Stat label="52W Low" value={fmtNum(stock.fiftyTwoWLow)} />
        <Stat label="EPS" value={stock.eps != null ? `$${stock.eps.toFixed(2)}` : "—"} />
        <Stat label="Low" value={fmtNum(stock.low)} />
        <Stat label="Mkt Cap" value={fmtCompact(stock.mktCap, true)} />
        <Stat label="Avg Vol" value={fmtCompact(stock.avgVol)} />
        <Stat label="Prev Close" value={fmtNum(stock.prevClose)} />
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
