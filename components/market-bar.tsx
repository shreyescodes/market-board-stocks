"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkline } from "./sparkline"
import { NumericText } from "./liquid-glass"
import { cn } from "@/lib/utils"

type IndexData = {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  direction: "up" | "down" | "flat"
  sparkline: number[]
}

// Real index symbols on Yahoo Finance
const INDICES: { symbol: string; name: string; fallback: number }[] = [
  { symbol: "^DJI", name: "Dow Jones", fallback: 52267.45 },
  { symbol: "^GSPC", name: "S&P 500", fallback: 7543.31 },
  { symbol: "^IXIC", name: "Nasdaq", fallback: 25480.12 },
]

// Offline fallback so the widgets never render empty
function generateFallbackIndex(name: string, symbol: string, startPrice: number): IndexData {
  const change = (Math.random() - 0.5) * (startPrice * 0.005)
  const changePercent = (change / (startPrice - change)) * 100
  const direction = change > 0.001 ? "up" : change < -0.001 ? "down" : "flat"
  const sparkline: number[] = []
  let curr = startPrice - change
  const step = change / 12
  for (let i = 0; i < 11; i++) {
    curr += step + (Math.random() - 0.5) * (startPrice * 0.0008)
    sparkline.push(Number(curr.toFixed(2)))
  }
  sparkline.push(Number(startPrice.toFixed(2)))
  return { symbol, name, price: startPrice, change, changePercent, direction, sparkline }
}

export function MarketBar() {
  const [etTime, setEtTime] = useState<Date | null>(null)
  const [indices, setIndices] = useState<IndexData[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadIndices() {
      try {
        const symbols = INDICES.map((i) => i.symbol).join(",")
        const res = await fetch(`/api/stocks?action=quotes&symbols=${encodeURIComponent(symbols)}`)
        if (!res.ok) throw new Error("API error")
        const data = await res.json()
        if (!data.stocks?.length) throw new Error("No index data")
        if (cancelled) return
        setIndices(
          INDICES.map((meta) => data.stocks.find((s: IndexData) => s.symbol === meta.symbol))
            .filter(Boolean)
            .map((s: IndexData) => ({
              ...s,
              name: INDICES.find((m) => m.symbol === s.symbol)?.name ?? s.name,
            })),
        )
      } catch {
        if (cancelled) return
        setIndices((prev) =>
          prev.length ? prev : INDICES.map((m) => generateFallbackIndex(m.name, m.symbol, m.fallback)),
        )
      }
    }
    loadIndices()
    const interval = setInterval(loadIndices, 12000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const update = () => {
      const etStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
      setEtTime(new Date(etStr))
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  const session = useMemo(() => {
    if (!etTime) return null
    const day = etTime.getDay()
    const t = etTime.getHours() * 3600 + etTime.getMinutes() * 60 + etTime.getSeconds()
    const fmt = (sec: number) => {
      const h = Math.floor(sec / 3600)
      const m = Math.floor((sec % 3600) / 60)
      const s = sec % 60
      return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`
    }

    if (day === 0 || day === 6) {
      return { status: "CLOSED", label: "Closed", sub: "Opens Monday 9:30 AM ET", color: "var(--label-3)", progress: 0 }
    }
    const pre = 4 * 3600
    const open = 9.5 * 3600
    const close = 16 * 3600
    const after = 20 * 3600

    if (t >= pre && t < open)
      return { status: "PRE", label: "Pre-Market", sub: `Opens in ${fmt(open - t)}`, color: "var(--warn)", progress: (t - pre) / (open - pre) }
    if (t >= open && t < close)
      return { status: "OPEN", label: "Market Open", sub: `Closes in ${fmt(close - t)}`, color: "var(--up)", progress: (t - open) / (close - open) }
    if (t >= close && t < after)
      return { status: "AFTER", label: "After Hours", sub: `Ends in ${fmt(after - t)}`, color: "var(--tint)", progress: (t - close) / (after - close) }

    const left = t >= after ? 24 * 3600 - t + pre : pre - t
    return { status: "CLOSED", label: "Closed", sub: `Pre-market in ${fmt(left)}`, color: "var(--down)", progress: 0 }
  }, [etTime])

  return (
    <section className="hide-scrollbar overflow-x-auto rounded-[22px] bg-surface">
      <div className="grid min-w-[640px] grid-cols-4 divide-x divide-separator">
        {/* Session */}
        <div className="flex flex-col justify-center px-5 py-4">
          <span className="text-[13px] text-label-2">US Markets</span>
          <span className="mt-1 flex items-center gap-2 text-[17px] font-semibold">
            <span className="h-2 w-2 rounded-full" style={{ background: session?.color ?? "var(--label-3)" }} />
            {session?.label ?? "—"}
          </span>
          <span className="num mt-0.5 text-[13px] text-label-2">{session?.sub}</span>
          {session && session.progress > 0 && (
            <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full transition-[width] duration-1000"
                style={{ width: `${session.progress * 100}%`, background: session.color }}
              />
            </div>
          )}
        </div>

        {(indices.length ? indices : INDICES.map(() => null)).map((idx, i) =>
          idx ? (
            <IndexCell key={idx.symbol} idx={idx} />
          ) : (
            <div key={i} className="flex flex-col justify-center gap-2 px-5 py-4">
              <div className="h-3 w-16 animate-pulse rounded-full bg-fill" />
              <div className="h-4 w-28 animate-pulse rounded-full bg-fill" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-fill" />
            </div>
          ),
        )}
      </div>
    </section>
  )
}

function IndexCell({ idx }: { idx: IndexData }) {
  const isUp = idx.direction === "up"
  const isDown = idx.direction === "down"
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 flex-col">
        <span className="whitespace-nowrap text-[13px] text-label-2">{idx.name}</span>
        <NumericText
          value={idx.price}
          format={(n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          className="mt-1 text-[17px] font-semibold"
        />
        <span className={cn("num mt-0.5 whitespace-nowrap text-[13px] font-medium", isUp && "text-up", isDown && "text-down", !isUp && !isDown && "text-label-2")}>
          {idx.change >= 0 ? "+" : ""}
          {idx.change.toFixed(2)} ({idx.changePercent >= 0 ? "+" : ""}
          {idx.changePercent.toFixed(2)}%)
        </span>
      </div>
      <div className="hidden shrink-0 xl:block">
        <Sparkline data={idx.sparkline} direction={idx.direction} width={64} height={30} strokeWidth={1.5} />
      </div>
    </div>
  )
}
