"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Toaster, toast } from "sonner"
import { Header, type FeedState } from "./header"
import { MarketBar } from "./market-bar"
import { WatchlistTable, type WatchlistRow } from "./watchlist-table"
import { StockDetails } from "./stock-details"
import type { Stock } from "@/lib/stock-types"
import { DEFAULT_SYMBOLS, fetchQuotes } from "@/lib/stock-data"
import { usePoll } from "@/hooks/use-poll"

const WATCHLIST_KEY = "marketboard.watchlist"
const QUOTE_INTERVAL = 10_000

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) return parsed
  } catch {}
  return DEFAULT_SYMBOLS
}

function saveWatchlist(symbols: string[]) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols))
  } catch {}
}

export function StockTickerPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [symbols, setSymbols] = useState<string[] | null>(null)
  const [quotes, setQuotes] = useState<Record<string, Stock>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [feed, setFeed] = useState<FeedState>({ status: "connecting", lastUpdate: null })
  const detailRef = useRef<HTMLElement>(null)
  const prevStatus = useRef(feed.status)

  // Follow the system appearance on first load, like a native Apple app
  useEffect(() => {
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    const list = loadWatchlist()
    setSymbols(list)
    setSelected(list[0] ?? null)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const symbolsKey = symbols?.join(",") ?? ""

  // Quotes: one batched request every 10 s, backing off while the feed is failing
  usePoll(
    async () => {
      if (!symbols?.length) return true
      const result = await fetchQuotes(symbols)
      if (!result) {
        setFeed((f) => ({ ...f, status: f.lastUpdate ? "stale" : "offline" }))
        return false
      }
      setQuotes((prev) => {
        const next = { ...prev }
        for (const s of result.stocks) next[s.symbol] = s
        return next
      })
      setFeed({ status: result.stale ? "stale" : "live", lastUpdate: result.fetchedAt })
      return !result.stale
    },
    QUOTE_INTERVAL,
    symbolsKey,
    symbols !== null,
  )


  // Tell the user once when the feed degrades, and once when it recovers
  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = feed.status
    if (feed.status === prev) return
    if (feed.status === "offline") toast.error("Can't reach market data. Retrying automatically.", { id: "feed" })
    else if (feed.status === "stale") toast.warning("Market data is delayed. Showing the last update.", { id: "feed" })
    else if (feed.status === "live" && (prev === "stale" || prev === "offline")) toast.success("Market data restored", { id: "feed" })
  }, [feed.status])

  const updateSymbols = useCallback((next: string[]) => {
    setSymbols(next)
    saveWatchlist(next)
  }, [])

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
      if (!symbol || !symbols) return
      if (symbols.includes(symbol)) {
        selectSymbol(symbol)
        toast.info(`${symbol} is already in your watchlist`)
        return
      }
      toast.loading(`Looking up ${symbol}…`, { id: "add-ticker" })
      const result = await fetchQuotes([symbol])
      if (!result) {
        toast.error("Couldn't reach market data. Try again in a moment.", { id: "add-ticker" })
        return
      }
      const quote = result.stocks.find((s) => s.symbol === symbol)
      if (!quote) {
        toast.error(`No quote found for "${symbol}"`, { id: "add-ticker" })
        return
      }
      setQuotes((prev) => ({ ...prev, [symbol]: quote }))
      updateSymbols([...symbols, symbol])
      selectSymbol(symbol)
      toast.success(`Added ${symbol} · ${quote.name}`, { id: "add-ticker" })
    },
    [symbols, updateSymbols, selectSymbol],
  )

  const removeStock = useCallback(
    (symbol: string) => {
      if (!symbols) return
      const index = symbols.indexOf(symbol)
      if (index < 0) return
      const next = symbols.filter((s) => s !== symbol)
      updateSymbols(next)
      if (selected === symbol) setSelected(next[Math.min(index, next.length - 1)] ?? null)
      toast(`Removed ${symbol}`, {
        id: `remove-${symbol}`,
        action: {
          label: "Undo",
          onClick: () => {
            setSymbols((current) => {
              if (!current || current.includes(symbol)) return current
              const restored = [...current]
              restored.splice(Math.min(index, restored.length), 0, symbol)
              saveWatchlist(restored)
              return restored
            })
            setSelected(symbol)
          },
        },
      })
    },
    [symbols, selected, updateSymbols],
  )

  const toggleTheme = useCallback(() => setTheme((prev) => (prev === "dark" ? "light" : "dark")), [])

  const rows: WatchlistRow[] = (symbols ?? []).map((s) => ({ symbol: s, stock: quotes[s] }))
  const selectedStock = selected ? quotes[selected] : undefined

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <Toaster position="top-center" theme={theme} offset={80} toastOptions={{ className: "liquid-toast" }} />
      <div className="min-h-screen bg-background pb-12 text-foreground lg:pb-4">
        <Header theme={theme} feed={feed} onToggleTheme={toggleTheme} />

        <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 px-3 pt-4 sm:px-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-7">
          <aside className="lg:sticky lg:top-[84px] lg:h-[calc(100vh-100px)] lg:self-start">
            <WatchlistTable
              rows={rows}
              loaded={symbols !== null}
              feedStatus={feed.status}
              selectedSymbol={selected}
              onSelectStock={selectSymbol}
              onAddStock={addStock}
              onRemoveStock={removeStock}
            />
          </aside>

          <section ref={detailRef} className="min-w-0 scroll-mt-[76px] pt-1">
            <MarketBar />
            {selectedStock ? (
              <StockDetails stock={selectedStock} />
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-1 text-center">
                <span className="text-[17px] font-semibold">
                  {!selected
                    ? "No symbol selected"
                    : feed.status === "offline"
                      ? "Market data unavailable"
                      : "Loading quote…"}
                </span>
                <span className="text-[13px] text-label-2">
                  {!selected
                    ? "Add a symbol to your watchlist to see its chart."
                    : feed.status === "offline"
                      ? "Yahoo Finance can't be reached right now. Retrying automatically."
                      : "Fetching the latest price from Yahoo Finance."}
                </span>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
