"use client"

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react"
import { DEFAULT_MARKET, MARKETS, marketById, type Market } from "@/lib/markets"
import { useStoredString, writeStored } from "@/hooks/use-browser"

/* The market chosen in the market bar drives the whole Markets page, so it lives here */

const MARKET_KEY = "marketboard.market"

/** `ready` turns true once the saved choice is restored, so pages don't fetch the default market first */
type MarketApi = { market: Market; setMarket: (id: string) => void; ready: boolean }

const MarketContext = createContext<MarketApi | null>(null)

export function MarketProvider({ children }: { children: ReactNode }) {
  // Restored from storage after hydration, and kept in sync with other tabs
  const saved = useStoredString(MARKET_KEY)
  const ready = saved !== undefined
  const market = marketById(saved ?? DEFAULT_MARKET) ?? MARKETS[0]

  const setMarket = useCallback((id: string) => {
    if (marketById(id)) writeStored(MARKET_KEY, id)
  }, [])

  const value = useMemo(() => ({ market, setMarket, ready }), [market, setMarket, ready])
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error("useMarket must be used inside MarketProvider")
  return ctx
}
