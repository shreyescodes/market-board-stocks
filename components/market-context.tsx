"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { DEFAULT_MARKET, MARKETS, marketById, type Market } from "@/lib/markets"

/* The market chosen in the market bar drives the whole Markets page, so it lives here */

const MARKET_KEY = "marketboard.market"

/** `ready` turns true once the saved choice is restored, so pages don't fetch the default market first */
type MarketApi = { market: Market; setMarket: (id: string) => void; ready: boolean }

const MarketContext = createContext<MarketApi | null>(null)

const readSaved = () => {
  try {
    const raw = localStorage.getItem(MARKET_KEY)
    return raw && marketById(raw) ? raw : null
  } catch {
    return null
  }
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [marketId, setMarketId] = useState(DEFAULT_MARKET)
  const [ready, setReady] = useState(false)

  // Restore after mount (localStorage is client-only) and follow changes made in other tabs
  useEffect(() => {
    const saved = readSaved()
    if (saved) setMarketId(saved)
    setReady(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key === MARKET_KEY) setMarketId(readSaved() ?? DEFAULT_MARKET)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setMarket = useCallback((id: string) => {
    if (!marketById(id)) return
    setMarketId(id)
    try {
      localStorage.setItem(MARKET_KEY, id)
    } catch {}
  }, [])

  const value = useMemo(() => ({ market: marketById(marketId) ?? MARKETS[0], setMarket, ready }), [marketId, setMarket, ready])
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error("useMarket must be used inside MarketProvider")
  return ctx
}
