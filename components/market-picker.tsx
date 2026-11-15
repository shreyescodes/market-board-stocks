"use client"

import { useMemo, useState } from "react"
import { Check } from "lucide-react"
import { Sheet, SheetSearch } from "./sheet"
import { useMarket } from "./market-context"
import { useNow } from "@/hooks/use-browser"
import { MARKETS, getMarketStatus } from "@/lib/markets"
import { cn } from "@/lib/utils"

const REGIONS = ["Americas", "Europe", "Middle East & Africa", "Asia-Pacific"] as const

/* Pick the market that every page looks through: name, exchange, local time and live session */
export function MarketPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { market: current, setMarket, liveFor } = useMarket()
  const now = useNow()
  const [query, setQuery] = useState("")
  // Clear the search when the sheet closes (adjusting state during render, not in an effect)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) setQuery("")
  }

  const rows = useMemo(() => {
    if (!now) return []
    return MARKETS.map((m) => ({ market: m, status: getMarketStatus(m, now, liveFor(m.id)) }))
  }, [now, liveFor])

  const openCount = rows.filter((r) => r.status.state === "open").length
  const q = query.trim().toLowerCase()
  const groups = REGIONS.map((region) => ({
    region,
    items: rows.filter(
      (r) =>
        r.market.region === region &&
        (!q ||
          r.market.name.toLowerCase().includes(q) ||
          r.market.city.toLowerCase().includes(q) ||
          r.market.exchange.toLowerCase().includes(q)),
    ),
  })).filter((g) => g.items.length)

  const choose = (id: string) => {
    setMarket(id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Choose a market" subtitle={`${openCount} of ${MARKETS.length} open now · every page follows your choice`}>
      <SheetSearch value={query} onChange={setQuery} placeholder="Search countries, cities or exchanges" />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g) => (
          <div key={g.region} className="pt-2">
            <div className="px-3 pb-1 text-[12px] font-semibold text-label-2">{g.region}</div>
            {g.items.map(({ market, status }) => {
              const isCurrent = market.id === current.id
              return (
                <button
                  key={market.id}
                  onClick={() => choose(market.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[20px] px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-tint/60 hover:bg-selection active:bg-selection",
                    isCurrent && "bg-selection",
                  )}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 text-[15px] font-medium">
                      {market.name}
                      {isCurrent && <Check className="h-4 w-4 text-tint" strokeWidth={2.5} aria-label="current" />}
                    </span>
                    <span className="truncate text-[12px] text-label-2">
                      {market.exchange} · {market.city} · <span className="num">{status.localTime}</span>
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span
                      className="flex items-center gap-1.5 text-[13px] font-semibold"
                      style={{ color: status.state === "closed" || status.state === "holiday" ? "var(--label-2)" : status.color }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} aria-hidden />
                      {status.label}
                    </span>
                    <span className="num text-[12px] text-label-2">{status.detail}</span>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
        {groups.length === 0 && <div className="py-10 text-center text-[13px] text-label-2">No matching markets</div>}
      </div>
    </Sheet>
  )
}
