"use client"

import { useMemo } from "react"
import { Pin } from "lucide-react"
import { Sheet } from "./sheet"
import { useMarket } from "./market-context"
import { useStoredString, writeStored } from "@/hooks/use-browser"
import { MAX_INDICES, defaultIndexesFor, indexMeta, indexesFor } from "@/lib/indices"
import { marketById } from "@/lib/markets"
import { profileFor } from "@/lib/market-profiles"
import { formatPercent, formatPrice } from "@/lib/format"
import type { Stock } from "@/lib/stock-types"
import { cn } from "@/lib/utils"

const INDICES_KEY = "marketboard.indicesByMarket"

/** Saved index choices, validated: unknown markets and symbols are dropped */
function parseSelection(raw: string | null | undefined): Record<string, string[]> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const clean: Record<string, string[]> = {}
    for (const [id, list] of Object.entries(parsed)) {
      if (!marketById(id) || !Array.isArray(list)) continue
      clean[id] = list.filter((s) => typeof s === "string" && indexMeta(id, s)).slice(0, MAX_INDICES)
    }
    return clean
  } catch {
    return {}
  }
}

/** The indexes pinned to the header for the current market (up to three), kept per market */
export function usePinnedIndexes() {
  const { market } = useMarket()
  const saved = useStoredString(INDICES_KEY)
  const byMarket = useMemo(() => parseSelection(saved), [saved])
  const pinned = byMarket[market.id]?.length ? byMarket[market.id] : defaultIndexesFor(market.id)
  const setPinned = (next: string[]) => writeStored(INDICES_KEY, JSON.stringify({ ...byMarket, [market.id]: next.slice(0, MAX_INDICES) }))
  const toggle = (symbol: string) => {
    if (pinned.includes(symbol)) {
      if (pinned.length > 1) setPinned(pinned.filter((s) => s !== symbol))
    } else if (pinned.length < MAX_INDICES) setPinned([...pinned, symbol])
  }
  return { pinned, toggle }
}

/* Every index for the market with live values; pin up to three to the header */
export function IndexesSheet({
  open,
  onClose,
  quotes,
  pinned,
  onToggle,
}: {
  open: boolean
  onClose: () => void
  quotes: Record<string, Stock>
  pinned: string[]
  onToggle: (symbol: string) => void
}) {
  const { market } = useMarket()
  // Euro Stoxx 50 is listed under several markets; show each index once
  const items = [...new Map(indexesFor(market.id).map((i) => [i.symbol, i])).values()]
  const full = pinned.length >= MAX_INDICES
  return (
    <Sheet open={open} onClose={onClose} title={`${market.name} indexes`} subtitle={`Pin up to ${MAX_INDICES} to the header · ${pinned.length} pinned`}>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
        {items.map((item) => {
          const q = quotes[item.symbol]
          const isOn = pinned.includes(item.symbol)
          const disabled = (!isOn && full) || (isOn && pinned.length === 1)
          return (
            <div key={item.symbol} className="flex items-center gap-3 rounded-[20px] px-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-medium">{item.name}</span>
                <span className="text-[12px] text-label-2">{item.source}</span>
              </div>
              <div className="num flex flex-col items-end">
                <span className="text-[15px] font-semibold">{q ? formatPrice(q.price, profileFor(market.id).currency) : "…"}</span>
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    q?.direction === "up" ? "text-up" : q?.direction === "down" ? "text-down" : "text-label-2",
                  )}
                >
                  {q ? formatPercent(q.changePercent) : ""}
                </span>
              </div>
              <button
                onClick={() => onToggle(item.symbol)}
                disabled={disabled}
                aria-pressed={isOn}
                aria-label={isOn ? `Unpin ${item.name}` : `Pin ${item.name} to the header`}
                className={cn(
                  "press flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-tint/60 disabled:opacity-30",
                  isOn ? "bg-tint-fill text-white" : "fill text-label-2 hover:bg-fill-hover",
                )}
              >
                <Pin className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
