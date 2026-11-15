"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { DEFAULT_MARKET, MARKETS, marketById, type LiveSession, type Market } from "@/lib/markets"
import { useNow, useStoredString, writeStored } from "@/hooks/use-browser"
import { usePoll } from "@/hooks/use-poll"
import { useFeed } from "./workspace"
import { fetchQuotes } from "@/lib/stock-data"
import type { Stock } from "@/lib/stock-types"

/*
 * The market chosen in the top bar is the lens for the whole app, so it lives here, together with
 * one shared feed of each market's main index: the picker, the Today header and the World page
 * all read it, and Yahoo's live session state on those quotes refines the open/closed status.
 */

const MARKET_KEY = "marketboard.market"

type MarketApi = {
  market: Market
  setMarket: (id: string) => void
  /** True once the saved choice is restored, so pages don't fetch the default market first */
  ready: boolean
  /** Latest quote of each market's main index, by market id */
  probes: Record<string, Stock>
  /** Yahoo's live session for a market, while fresh enough to trust */
  liveFor: (id: string) => LiveSession | null
}

const MarketContext = createContext<MarketApi | null>(null)

export function MarketProvider({ children }: { children: ReactNode }) {
  // Restored from storage after hydration, and kept in sync with other tabs
  const saved = useStoredString(MARKET_KEY)
  const ready = saved !== undefined
  const market = marketById(saved ?? DEFAULT_MARKET) ?? MARKETS[0]
  const now = useNow()
  const { report } = useFeed()

  const setMarket = useCallback((id: string) => {
    if (marketById(id)) writeStored(MARKET_KEY, id)
  }, [])

  // One batched request for the 16 main indexes, every minute
  const [probes, setProbes] = useState<{ at: number; byMarket: Record<string, Stock> } | null>(null)
  usePoll(
    async () => {
      const result = await fetchQuotes(MARKETS.map((m) => m.probe))
      // This feed runs on every page, so it keeps the toolbar's status current everywhere
      report(result)
      if (!result) return false
      const byMarket: Record<string, Stock> = {}
      for (const m of MARKETS) {
        const q = result.stocks.find((s) => s.symbol === m.probe)
        if (q) byMarket[m.id] = q
      }
      setProbes((prev) => ({ at: result.stale ? (prev?.at ?? 0) : Date.now(), byMarket: { ...prev?.byMarket, ...byMarket } }))
      return !result.stale
    },
    60_000,
    "probes",
  )

  // Only trust live session data while it is fresh; stale data could wrongly mark a market closed
  const fresh = !!probes && !!now && now.getTime() - probes.at < 3 * 60_000
  const liveFor = useCallback(
    (id: string): LiveSession | null => {
      const q = fresh ? probes?.byMarket[id] : undefined
      return q ? { marketState: q.marketState ?? null, lastTrade: q.asOf ?? null } : null
    },
    [fresh, probes],
  )

  const value = useMemo(
    () => ({ market, setMarket, ready, probes: probes?.byMarket ?? {}, liveFor }),
    [market, setMarket, ready, probes, liveFor],
  )
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error("useMarket must be used inside MarketProvider")
  return ctx
}
