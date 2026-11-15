"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"
import { StockDetails } from "./stock-details"
import { PositionSheet } from "./position-sheet"
import { useFeed, useWorkspace } from "./workspace"
import { useMarket } from "./market-context"
import { useQuotes } from "@/hooks/use-quotes"
import { marketForSymbol } from "@/lib/markets"
import { largeCapsFor, profileFor, type Sector } from "@/lib/market-profiles"
import { fetchProfiles } from "@/lib/stock-data"
import { displaySymbol, formatMoney, formatPercent, shortName } from "@/lib/format"
import { cn } from "@/lib/utils"

// Yahoo's profile sectors → the sector names used across the app
const YAHOO_SECTOR: Record<string, Sector> = {
  Technology: "Technology",
  "Financial Services": "Financials",
  Healthcare: "Health Care",
  Energy: "Energy",
  "Basic Materials": "Materials",
  Industrials: "Industrials",
  "Consumer Cyclical": "Consumer Disc.",
  "Consumer Defensive": "Consumer Staples",
  "Communication Services": "Communication",
  Utilities: "Utilities",
  "Real Estate": "Real Estate",
}

export function SymbolView({ symbol }: { symbol: string }) {
  const router = useRouter()
  const { ready, activeWatchlist, addSymbol, workspace } = useWorkspace()
  const { feed } = useFeed()
  const { quotes, state } = useQuotes([symbol], 10_000)
  const [adding, setAdding] = useState(false)
  const quote = quotes[symbol]
  const inList = !!activeWatchlist?.symbols.includes(symbol)
  const held = workspace?.positions.find((p) => p.symbol === symbol)

  // Where it trades and what it does: breadcrumb and same-sector peers from that market's largest listings
  const { setMarket } = useMarket()
  const home = marketForSymbol(symbol)
  const caps = useMemo(() => (home ? largeCapsFor(profileFor(home.id)) : []), [home])
  const tagged = caps.find((c) => c.symbol === symbol)?.sector ?? null
  const [profiled, setProfiled] = useState<{ symbol: string; sector: Sector | null } | null>(null)
  useEffect(() => {
    if (tagged || !home) return
    let alive = true
    fetchProfiles([symbol]).then((p) => {
      const raw = p?.[symbol]?.sector
      if (alive) setProfiled({ symbol, sector: raw ? (YAHOO_SECTOR[raw] ?? null) : null })
    })
    return () => {
      alive = false
    }
  }, [symbol, tagged, home])
  const sector = tagged ?? (profiled?.symbol === symbol ? profiled.sector : null)
  const peerSymbols = useMemo(
    () => (sector ? caps.filter((c) => c.sector === sector && c.symbol !== symbol).map((c) => c.symbol).slice(0, 4) : []),
    [caps, sector, symbol],
  )
  const { quotes: peerQuotes } = useQuotes(peerSymbols, 30_000, { enabled: peerSymbols.length > 0, report: false })

  const back = () => (window.history.length > 1 ? router.back() : router.push("/"))
  const pill = "press flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-tint/60"

  return (
    <div className="flex flex-col pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button onClick={back} className={`${pill} -ml-2 text-tint`}>
            <ChevronLeft className="h-5 w-5" aria-hidden /> Back
          </button>
          {home && (
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[14px]">
              <Link
                href="/"
                onClick={() => setMarket(home.id)}
                className="-my-2 truncate rounded-[6px] py-2 font-semibold text-tint outline-none focus-visible:ring-2 focus-visible:ring-tint/60"
              >
                {home.name}
              </Link>
              {sector && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-label-2" aria-hidden />
                  <span className="truncate text-label-2">{sector}</span>
                </>
              )}
            </nav>
          )}
        </div>
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

      {home && sector && peerSymbols.length > 0 && (
        <section aria-labelledby="peers" className="mt-6 flex flex-col gap-3 rounded-[22px] bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="peers" className="text-[17px] font-semibold">
              More in {sector.toLowerCase()} · {home.name}
            </h2>
            <span className="text-[12px] text-label-2">From the largest {home.exchange} listings</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {peerSymbols.map((p) => {
              const q = peerQuotes[p]
              return (
                <Link
                  key={p}
                  href={`/symbol/${encodeURIComponent(p)}`}
                  className="press flex flex-col gap-1 rounded-[16px] bg-surface-2 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-tint/60"
                >
                  <span className="line-clamp-2 text-[15px] font-semibold leading-tight">{q ? shortName(q.name) : displaySymbol(p)}</span>
                  <span className="text-[12px] text-label-2">{displaySymbol(p)}</span>
                  <span className="num mt-1.5 flex justify-between text-[14px]">
                    <span>{q ? formatMoney(q.price, q.currency) : "…"}</span>
                    <span className={cn("font-semibold", q?.direction === "up" ? "text-up" : q?.direction === "down" ? "text-down" : "text-label-2")}>
                      {q ? formatPercent(q.changePercent) : ""}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <PositionSheet open={adding} initial={adding ? { symbol } : null} onClose={() => setAdding(false)} />
    </div>
  )
}
