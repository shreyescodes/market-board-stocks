"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft, Plus } from "lucide-react"
import { toast } from "sonner"
import { StockDetails } from "./stock-details"
import { PositionSheet } from "./position-sheet"
import { useFeed, useWorkspace } from "./workspace"
import { useQuotes } from "@/hooks/use-quotes"

export function SymbolView({ symbol }: { symbol: string }) {
  const router = useRouter()
  const { ready, activeWatchlist, addSymbol, workspace } = useWorkspace()
  const { feed } = useFeed()
  const { quotes, state } = useQuotes([symbol], 10_000)
  const [adding, setAdding] = useState(false)
  const quote = quotes[symbol]
  const inList = !!activeWatchlist?.symbols.includes(symbol)
  const held = workspace?.positions.find((p) => p.symbol === symbol)

  const back = () => (window.history.length > 1 ? router.back() : router.push("/"))
  const pill = "press flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-tint/60"

  return (
    <div className="flex flex-col pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={back} className={`${pill} -ml-2 text-tint`}>
          <ChevronLeft className="h-5 w-5" aria-hidden /> Back
        </button>
        {quote && ready && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!activeWatchlist || inList) return
                addSymbol(activeWatchlist.id, symbol)
                toast.success(`Added ${symbol} to ${activeWatchlist.name}`)
              }}
              disabled={inList}
              className={`${pill} fill hover:bg-fill-hover disabled:opacity-100`}
            >
              {inList ? <Check className="h-4 w-4 text-tint" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              {inList ? `In ${activeWatchlist?.name}` : "Add to Watchlist"}
            </button>
            <button onClick={() => setAdding(true)} className={`${pill} bg-tint-fill text-white`}>
              <Plus className="h-4 w-4" aria-hidden /> {held ? "Add Shares" : "Add to Portfolio"}
            </button>
          </div>
        )}
      </div>

      {quote ? (
        <StockDetails stock={quote} />
      ) : (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-1 text-center">
          <span className="text-[17px] font-semibold">
            {state === "loading" ? `Loading ${symbol}…` : feed.status === "offline" || state === "error" ? "Market data unavailable" : `No quote for ${symbol}`}
          </span>
          <span className="text-[13px] text-label-2">
            {state === "loading"
              ? "Fetching the latest price from Yahoo Finance."
              : feed.status === "offline" || state === "error"
                ? "Yahoo Finance can't be reached right now. Retrying automatically."
                : "Yahoo Finance doesn't recognise this symbol."}
          </span>
        </div>
      )}

      <PositionSheet open={adding} initial={adding ? { symbol } : null} onClose={() => setAdding(false)} />
    </div>
  )
}
