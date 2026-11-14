"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { WatchlistTable, type WatchlistRow } from "./watchlist-table"
import { WatchlistsSheet } from "./watchlists-sheet"
import { StockDetails } from "./stock-details"
import { useFeed, useWorkspace } from "./workspace"
import { useQuotes } from "@/hooks/use-quotes"
import { fetchQuotes } from "@/lib/stock-data"

export function WatchlistsView() {
  const { ready, activeWatchlist, addSymbol, removeSymbol, insertSymbol } = useWorkspace()
  const { feed } = useFeed()
  const symbols = activeWatchlist?.symbols ?? []
  const { quotes } = useQuotes(symbols, 10_000, { enabled: ready })
  const [selected, setSelected] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)
  const detailRef = useRef<HTMLElement>(null)

  // Keep a valid selection when switching lists or removing the selected symbol
  useEffect(() => {
    if (!activeWatchlist) return
    if (!selected || !activeWatchlist.symbols.includes(selected)) setSelected(activeWatchlist.symbols[0] ?? null)
  }, [activeWatchlist, selected])

  const selectSymbol = useCallback((symbol: string) => {
    setSelected(symbol)
    // On narrow screens the chart sits below the list; bring it into view
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
  }, [])

  const addStock = useCallback(
    async (raw: string) => {
      const symbol = raw.trim().toUpperCase()
      if (!symbol || !activeWatchlist) return
      if (activeWatchlist.symbols.includes(symbol)) {
        selectSymbol(symbol)
        toast.info(`${symbol} is already in ${activeWatchlist.name}`)
        return
      }
      toast.loading(`Looking up ${symbol}…`, { id: "add-ticker" })
      const result = await fetchQuotes([symbol])
      if (!result) return void toast.error("Couldn't reach market data. Try again in a moment.", { id: "add-ticker" })
      const quote = result.stocks.find((s) => s.symbol === symbol)
      if (!quote) return void toast.error(`No quote found for "${symbol}"`, { id: "add-ticker" })
      addSymbol(activeWatchlist.id, symbol)
      selectSymbol(symbol)
      toast.success(`Added ${symbol} · ${quote.name}`, { id: "add-ticker" })
    },
    [activeWatchlist, addSymbol, selectSymbol],
  )

  const removeStock = useCallback(
    (symbol: string) => {
      if (!activeWatchlist) return
      const listId = activeWatchlist.id
      const index = removeSymbol(listId, symbol)
      toast(`Removed ${symbol}`, {
        id: `remove-${symbol}`,
        action: { label: "Undo", onClick: () => insertSymbol(listId, symbol, index) },
      })
    },
    [activeWatchlist, removeSymbol, insertSymbol],
  )

  const rows: WatchlistRow[] = symbols.map((s) => ({ symbol: s, stock: quotes[s] }))
  const selectedStock = selected ? quotes[selected] : undefined

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6">
      <aside className="lg:sticky lg:top-[84px] lg:h-[calc(100vh-100px)] lg:self-start">
        <WatchlistTable
          rows={rows}
          loaded={ready}
          feedStatus={feed.status}
          listName={activeWatchlist?.name ?? "Watchlist"}
          onManageLists={() => setManaging(true)}
          selectedSymbol={selected}
          onSelectStock={selectSymbol}
          onAddStock={addStock}
          onRemoveStock={removeStock}
        />
      </aside>

      <section ref={detailRef} className="min-w-0 scroll-mt-[76px]">
        {selectedStock ? (
          <StockDetails stock={selectedStock} />
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-1 text-center">
            <span className="text-[17px] font-semibold">
              {!selected ? "This watchlist is empty" : feed.status === "offline" ? "Market data unavailable" : "Loading quote…"}
            </span>
            <span className="text-[13px] text-label-2">
              {!selected
                ? "Tap + to add a symbol."
                : feed.status === "offline"
                  ? "Yahoo Finance can't be reached right now. Retrying automatically."
                  : "Fetching the latest price from Yahoo Finance."}
            </span>
          </div>
        )}
      </section>

      <WatchlistsSheet open={managing} onClose={() => setManaging(false)} />
    </div>
  )
}
