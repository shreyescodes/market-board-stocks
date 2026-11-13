"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Header } from "./header"
import { MarketBar } from "./market-bar"
import { WatchlistTable } from "./watchlist-table"
import { StockDetails } from "./stock-details"
import type { Stock } from "@/lib/stock-types"
import {
  generateInitialStocks,
  generateHistoryForPrice,
  fetchRealQuotes,
  DEFAULT_STOCKS,
  simulateStockUpdate,
} from "@/lib/stock-data"
import { Toaster, toast } from "sonner"

export function StockTickerPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [live, setLive] = useState(false)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Follow the system appearance on first load, like a native Apple app
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setTheme(mq.matches ? "dark" : "light")
  }, [])

  // Keep the document chrome (scrollbars, overscroll) in sync with the appearance
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.style.colorScheme = theme
  }, [theme])

  // Fetch initial real-time quotes on mount
  useEffect(() => {
    async function initStocks() {
      setLoading(true)
      const symbols = DEFAULT_STOCKS.map((s) => s.symbol)
      const realData = await fetchRealQuotes(symbols)

      if (realData && realData.length > 0) {
        setStocks(realData)
        setSelectedStockId(realData[0].id)
        setLive(true)
        toast.success("Connected to live Yahoo Finance market feed")
      } else {
        // Fallback gracefully to offline mock generator if proxy API is limited
        const mockData = generateInitialStocks()
        setStocks(mockData)
        setSelectedStockId(mockData[0].id)
        setLive(false)
        toast.error("Live feed unavailable. Showing simulated prices.")
      }
      setLoading(false)
    }

    initStocks()
  }, [])

  // Poll Yahoo Finance API every 10 seconds for real-time stock quotes
  useEffect(() => {
    if (stocks.length === 0) return

    const interval = setInterval(async () => {
      const symbols = stocks.map((s) => s.symbol)
      const freshQuotes = await fetchRealQuotes(symbols)

      if (freshQuotes && freshQuotes.length > 0) {
        setStocks((prevStocks) =>
          prevStocks.map((oldStock) => {
            const updated = freshQuotes.find((q) => q.symbol === oldStock.symbol)
            if (!updated) return oldStock

            // Slide new price into the existing sparkline to animate it live!
            const newSparkline = [...oldStock.sparkline.slice(1), Number(updated.price.toFixed(2))]

            return {
              ...oldStock,
              ...updated,
              sparkline: newSparkline,
            }
          })
        )
      } else {
        // API rate limited/throttled or offline: fluctuate stocks simulated
        setStocks((prevStocks) => {
          const updatedStocks = [...prevStocks]
          const numToUpdate = Math.floor(Math.random() * 4) + 1
          const indicesToUpdate = new Set<number>()

          while (indicesToUpdate.size < Math.min(numToUpdate, updatedStocks.length)) {
            indicesToUpdate.add(Math.floor(Math.random() * updatedStocks.length))
          }

          indicesToUpdate.forEach((index) => {
            updatedStocks[index] = simulateStockUpdate(updatedStocks[index])
          })
          return updatedStocks
        })
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [stocks])

  // Selected Stock Memo
  const selectedStock = useMemo(() => {
    if (!selectedStockId) return null
    return stocks.find((stock) => stock.id === selectedStockId) || null
  }, [stocks, selectedStockId])

  // Active fallback selection
  useEffect(() => {
    if (stocks.length > 0 && !selectedStockId) {
      setSelectedStockId(stocks[0].id)
    }
  }, [stocks, selectedStockId])

  // Add stock symbol with real-time API quote validation
  const addStock = useCallback(async (symbol: string, name: string) => {
    const cleanSymbol = symbol.trim().toUpperCase()
    if (!cleanSymbol) return

    // Prevent duplicate entries
    const exists = stocks.some((s) => s.symbol === cleanSymbol)
    if (exists) {
      const existingItem = stocks.find((s) => s.symbol === cleanSymbol)
      if (existingItem) {
        setSelectedStockId(existingItem.id)
        toast.info(`${cleanSymbol} is already in your watchlist.`)
      }
      return
    }

    toast.loading(`Validating symbol ${cleanSymbol} on Yahoo Finance...`, { id: "add-ticker" })

    // Verify symbol and retrieve quote details from the API proxy
    const realStock = await fetchRealQuotes([cleanSymbol])

    if (realStock && realStock.length > 0) {
      const newStockItem = realStock[0]
      setStocks((prev) => [...prev, newStockItem])
      setSelectedStockId(newStockItem.id)
      toast.success(`Successfully added ${cleanSymbol} (${newStockItem.name})`, { id: "add-ticker" })
    } else {
      // Symbol not found or API error: prevent invalid additions
      toast.error(`Error: Symbol "${cleanSymbol}" not found on Yahoo Finance.`, { id: "add-ticker" })
    }
  }, [stocks])

  const removeStock = useCallback((id: string) => {
    setStocks((prev) => {
      const filtered = prev.filter((stock) => stock.id !== id)
      if (selectedStockId === id) {
        setSelectedStockId(filtered.length > 0 ? filtered[0].id : null)
      }
      return filtered
    })
    toast.success("Ticker removed from watchlist.")
  }, [selectedStockId])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }, [])

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <Toaster position="top-center" theme={theme} offset={80} toastOptions={{ className: "liquid-toast" }} />
      <div className="min-h-screen bg-background pb-12 text-foreground lg:pb-4">
        <Header theme={theme} live={live} onToggleTheme={toggleTheme} />

        <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 px-3 pt-4 sm:px-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-7">
          {/* Floating glass sidebar */}
          <aside className="lg:sticky lg:top-[84px] lg:h-[calc(100vh-100px)] lg:self-start">
            <WatchlistTable
              stocks={stocks}
              selectedStockId={selectedStockId}
              onSelectStock={setSelectedStockId}
              onAddStock={addStock}
              onRemoveStock={removeStock}
            />
          </aside>

          {/* Content */}
          <section className="min-w-0 pt-1">
            <MarketBar />
            {selectedStock ? (
              <StockDetails stock={selectedStock} />
            ) : (
              <div className="flex min-h-[360px] items-center justify-center text-[15px] text-label-2">
                {loading ? "Connecting to market feed…" : "Select a symbol to see its chart."}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
