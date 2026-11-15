"use client"

import { useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Check, Clock, Plus, Search as SearchIcon } from "lucide-react"
import { toast } from "sonner"
import { Sheet } from "./sheet"
import { useWorkspace } from "./workspace"
import { useStoredString, writeStored } from "@/hooks/use-browser"
import { fetchQuotes } from "@/lib/stock-data"
import { exchangeName, marketForSymbol } from "@/lib/markets"
import { displaySymbol, formatMoney, formatPercent, shortName } from "@/lib/format"
import type { Stock } from "@/lib/stock-types"
import { cn } from "@/lib/utils"

type Result = { symbol: string; name: string; exchange: string; type?: string }

const RECENT_KEY = "marketboard.recentSearches"
const symbolHref = (s: string) => `/symbol/${encodeURIComponent(s)}`

function parseRecent(raw: string | null | undefined): Result[] {
  try {
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((r) => r && typeof r.symbol === "string" && typeof r.name === "string").slice(0, 6) : []
  } catch {
    return []
  }
}

/* Search any stock, ETF or index from anywhere (Cmd+K): open its page or add it to a watchlist */
export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { activeWatchlist, addSymbol } = useWorkspace()
  const [query, setQuery] = useState("")
  const [found, setFound] = useState<{ query: string; results: Result[] }>({ query: "", results: [] })
  const [quotes, setQuotes] = useState<Record<string, Stock>>({})
  const [active, setActive] = useState(0)
  const recent = parseRecent(useStoredString(RECENT_KEY))

  // Start fresh each time the sheet opens (adjusting state during render, not in an effect)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery("")
      setActive(0)
    }
  }

  const q = query.trim()
  useEffect(() => {
    if (!q) return
    let alive = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks?action=search&query=${encodeURIComponent(q)}`)
        const results: Result[] = res.ok ? ((await res.json()).results ?? []) : []
        if (!alive) return
        setFound({ query: q, results })
        setActive(0)
        const priced = await fetchQuotes(results.map((r) => r.symbol))
        if (alive && priced) setQuotes((prev) => ({ ...prev, ...Object.fromEntries(priced.stocks.map((s) => [s.symbol, s])) }))
      } catch {
        if (alive) setFound({ query: q, results: [] })
      }
    }, 180)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  // Prices for recent items when the field is empty
  const recentKey = recent.map((r) => r.symbol).join(",")
  useEffect(() => {
    if (!open || !recentKey) return
    let alive = true
    fetchQuotes(recentKey.split(",")).then((priced) => {
      if (alive && priced) setQuotes((prev) => ({ ...prev, ...Object.fromEntries(priced.stocks.map((s) => [s.symbol, s])) }))
    })
    return () => {
      alive = false
    }
  }, [open, recentKey])

  const showingRecent = !q
  const rows = useMemo(() => (showingRecent ? recent : found.query === q ? found.results : []), [showingRecent, recent, found, q])
  const searching = !!q && found.query !== q

  const remember = (r: Result) => {
    const next = [r, ...recent.filter((x) => x.symbol !== r.symbol)].slice(0, 6)
    writeStored(RECENT_KEY, JSON.stringify(next))
  }
  const openResult = (r: Result) => {
    remember(r)
    onClose()
    router.push(symbolHref(r.symbol))
  }
  const addResult = (r: Result) => {
    if (!activeWatchlist) return
    if (activeWatchlist.symbols.includes(r.symbol)) {
      toast(`${r.name} is already in ${activeWatchlist.name}`)
      return
    }
    remember(r)
    addSymbol(activeWatchlist.id, r.symbol)
    toast.success(`Added ${r.name} to ${activeWatchlist.name}`)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!rows.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % rows.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i - 1 + rows.length) % rows.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const r = rows[Math.min(active, rows.length - 1)]
      if (e.metaKey || e.ctrlKey) addResult(r)
      else openResult(r)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Search" subtitle="Stocks, ETFs and indexes on every exchange Yahoo covers">
      <div className="px-4 pb-2">
        <div className="fill flex h-11 items-center gap-2 rounded-full pl-3.5 pr-2 focus-within:ring-2 focus-within:ring-tint/40">
          <SearchIcon className="h-[18px] w-[18px] shrink-0 text-label-2" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Company, ticker or index"
            aria-label="Search stocks, ETFs and indexes"
            aria-controls="search-results"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-label-2"
          />
        </div>
      </div>
      <div id="search-results" role="listbox" aria-label={showingRecent ? "Recent" : "Results"} className="min-h-[120px] flex-1 overflow-y-auto px-2 pb-2">
        {showingRecent && rows.length > 0 && <div className="px-3 pb-1 pt-1 text-[12px] font-semibold text-label-2">Recent</div>}
        {rows.map((r, i) => {
          const quote = quotes[r.symbol]
          const market = marketForSymbol(r.symbol)
          const inList = !!activeWatchlist?.symbols.includes(r.symbol)
          const where = r.type === "INDEX" ? "Index" : r.type === "ETF" ? `ETF · ${market?.name ?? ""}` : (market?.name ?? "")
          return (
            <div
              key={r.symbol}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              className={cn("flex items-center gap-3 rounded-[16px] px-3 py-2.5", i === active && "bg-selection")}
            >
              <button onClick={() => openResult(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-tint/60">
                {showingRecent && <Clock className="h-4 w-4 shrink-0 text-label-2" aria-hidden />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{shortName(r.name)}</span>
                  <span className="truncate text-[12px] text-label-2">
                    {displaySymbol(r.symbol)}
                    {where ? ` · ${where}` : ""}
                  </span>
                </span>
                {r.exchange && (
                  <span className="hidden shrink-0 rounded-[5px] border border-separator px-1.5 py-px text-[10px] font-bold text-label-2 sm:inline">
                    {exchangeName(r.exchange)}
                  </span>
                )}
                <span className="num flex w-[92px] shrink-0 flex-col items-end">
                  <span className="text-[14px] font-medium">{quote ? formatMoney(quote.price, quote.currency) : ""}</span>
                  <span className={cn("text-[12px] font-semibold", quote?.direction === "up" ? "text-up" : quote?.direction === "down" ? "text-down" : "text-label-2")}>
                    {quote ? formatPercent(quote.changePercent) : ""}
                  </span>
                </span>
              </button>
              {r.type !== "INDEX" && (
                <button
                  onClick={() => addResult(r)}
                  aria-label={inList ? `${r.name} is in ${activeWatchlist?.name}` : `Add ${r.name} to ${activeWatchlist?.name ?? "watchlist"}`}
                  className={cn(
                    "press flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-tint/60",
                    inList ? "text-tint" : "fill text-label-2 hover:bg-fill-hover hover:text-foreground",
                  )}
                >
                  {inList ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
                </button>
              )}
            </div>
          )
        })}
        {searching && <p className="px-3 py-6 text-center text-[13px] text-label-2">Searching…</p>}
        {!searching && q && rows.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-label-2">No matches for “{q}”</p>}
        {showingRecent && rows.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-label-2">Search by company name, ticker or index, e.g. Reliance, AAPL, Nifty</p>}
      </div>
      <div className="hidden gap-4 border-t border-separator px-5 py-2.5 text-[12px] text-label-2 sm:flex">
        <span>↵ open</span>
        <span>⌘↵ add to {activeWatchlist?.name ?? "watchlist"}</span>
        <span>↑↓ move</span>
        <span className="ml-auto">esc close</span>
      </div>
    </Sheet>
  )
}
