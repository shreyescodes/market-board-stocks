"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Check, Clock, Plus, Search as SearchIcon, X } from "lucide-react"
import { toast } from "sonner"
import { Sheet } from "./sheet"
import { useWorkspace } from "./workspace"
import { useMarket } from "./market-context"
import { usePinnedIndexes } from "./indexes-sheet"
import { useStoredString, writeStored } from "@/hooks/use-browser"
import { fetchQuotes } from "@/lib/stock-data"
import { exchangeName, marketForSymbol } from "@/lib/markets"
import { indexMeta } from "@/lib/indices"
import { largeCapsFor, profileFor } from "@/lib/market-profiles"
import { displaySymbol, formatMoney, formatPercent, formatPrice, shortName } from "@/lib/format"
import type { Stock } from "@/lib/stock-types"
import { cn } from "@/lib/utils"

type Result = { symbol: string; name: string; exchange: string; type?: string }
type Group = { label: string; recent?: boolean; rows: Result[] }

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

/** Listings in the market you're looking at come first (HDFC Bank on NSE before its NYSE ADR); otherwise Yahoo's order */
function homeFirst(results: Result[], marketId: string) {
  const home = (r: Result) => (marketForSymbol(r.symbol)?.id === marketId ? 0 : 1)
  return results.map((r, i) => ({ r, i })).sort((a, b) => home(a.r) - home(b.r) || a.i - b.i).map(({ r }) => r)
}

/* Spotlight-style search from anywhere (Cmd+K): open a symbol's page or add it to a watchlist */
export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { activeWatchlist, addSymbol } = useWorkspace()
  const { market } = useMarket()
  const { pinned } = usePinnedIndexes()
  const [query, setQuery] = useState("")
  // fuzzy: nothing matched as typed, so these are the closest spellings (the API forgives a typo or two)
  const [found, setFound] = useState<{ query: string; results: Result[]; fuzzy?: boolean }>({ query: "", results: [] })
  const [quotes, setQuotes] = useState<Record<string, Stock>>({})
  const [active, setActive] = useState(0)
  const fieldRef = useRef<HTMLInputElement>(null)
  const recentRaw = useStoredString(RECENT_KEY)
  const recent = useMemo(() => parseRecent(recentRaw), [recentRaw])

  // Start fresh each time it opens (adjusting state during render, not in an effect)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery("")
      setActive(0)
    }
  }

  // Before typing: where to start in the current market, its pinned indexes and largest companies
  const suggested = useMemo<Result[]>(() => {
    const seen = new Set(recent.slice(0, 4).map((r) => r.symbol))
    const caps = largeCapsFor(profileFor(market.id))
      .filter((c) => !seen.has(c.symbol))
      .slice(0, 4)
    return [
      ...pinned.filter((s) => !seen.has(s)).map((s) => ({ symbol: s, name: indexMeta(market.id, s)?.name ?? s, exchange: "", type: "INDEX" })),
      ...caps.map((c) => ({ symbol: c.symbol, name: c.symbol, exchange: "", type: "EQUITY" })),
    ]
  }, [market.id, pinned, recent])

  const q = query.trim()
  useEffect(() => {
    if (!q) return
    let alive = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks?action=search&query=${encodeURIComponent(q)}`)
        const data = res.ok ? await res.json() : {}
        const results: Result[] = data.results ?? []
        if (!alive) return
        setFound({ query: q, results, fuzzy: !!data.fuzzy })
        setActive(0)
        const priced = await fetchQuotes(results.map((r) => r.symbol))
        if (alive && priced) setQuotes((prev) => ({ ...prev, ...Object.fromEntries(priced.stocks.map((s) => [s.symbol, s])) }))
      } catch {
        if (alive) setFound({ query: q, results: [] })
      }
    }, 160)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  // Prices for recent and suggested items while the field is empty
  const idleKey = [...recent, ...suggested].map((r) => r.symbol).join(",")
  useEffect(() => {
    if (!open || !idleKey) return
    let alive = true
    fetchQuotes([...new Set(idleKey.split(","))]).then((priced) => {
      if (alive && priced) setQuotes((prev) => ({ ...prev, ...Object.fromEntries(priced.stocks.map((s) => [s.symbol, s])) }))
    })
    return () => {
      alive = false
    }
  }, [open, idleKey])

  const groups: Group[] = q
    ? found.query === q && found.results.length
      ? [{ label: found.fuzzy ? `No exact match for “${q}”. Closest:` : "Results", rows: found.fuzzy ? found.results : homeFirst(found.results, market.id) }]
      : []
    : [
        ...(recent.length ? [{ label: "Recent", recent: true, rows: recent.slice(0, 4) }] : []),
        { label: `In ${market.name}`, rows: suggested },
      ]
  const rows = groups.flatMap((g) => g.rows)
  const searching = !!q && found.query !== q

  const nameOf = (r: Result) => {
    const quote = quotes[r.symbol]
    return shortName(r.type === "INDEX" ? r.name : (quote?.name ?? r.name))
  }
  const remember = (r: Result) => {
    const item = { symbol: r.symbol, name: nameOf(r), exchange: r.exchange || quotes[r.symbol]?.exchange || "", type: r.type }
    writeStored(RECENT_KEY, JSON.stringify([item, ...recent.filter((x) => x.symbol !== r.symbol)].slice(0, 6)))
  }
  const openResult = (r: Result) => {
    remember(r)
    onClose()
    router.push(symbolHref(r.symbol))
  }
  const addResult = (r: Result) => {
    if (!activeWatchlist) return
    if (activeWatchlist.symbols.includes(r.symbol)) {
      toast(`${nameOf(r)} is already in ${activeWatchlist.name}`)
      return
    }
    remember(r)
    addSymbol(activeWatchlist.id, r.symbol)
    toast.success(`Added ${nameOf(r)} to ${activeWatchlist.name}`)
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

  let index = -1
  return (
    <Sheet open={open} onClose={onClose} title="Search" variant="palette">
      {/* The field is the whole header */}
      <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-separator pl-5 pr-3">
        <SearchIcon className="h-5 w-5 shrink-0 text-label-2" aria-hidden />
        <input
          ref={fieldRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Search stocks, ETFs and indexes"
          aria-label="Search stocks, ETFs and indexes"
          aria-controls="search-results"
          aria-activedescendant={rows.length ? `search-row-${Math.min(active, rows.length - 1)}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-[19px] outline-none placeholder:text-label-2"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("")
              // The button disappears once the field is empty; keep typing where you were
              fieldRef.current?.focus()
            }}
            aria-label="Clear search"
            className="press flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-tint/60"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}
        <kbd className="hidden shrink-0 rounded-[6px] border border-separator px-1.5 py-0.5 font-sans text-[11px] font-semibold text-label-2 sm:block">esc</kbd>
        <button onClick={onClose} className="shrink-0 px-1 py-2 text-[15px] font-semibold text-tint outline-none sm:hidden">
          Cancel
        </button>
      </div>

      <div id="search-results" role="listbox" aria-label={q ? "Results" : "Suggestions"} className="min-h-0 overflow-y-auto overscroll-contain p-2">
        {groups.map((g) => (
          <div key={g.label} role="group" aria-label={g.label} className="pb-1">
            <div className="px-3 pb-1 pt-2 text-[12px] font-semibold text-label-2">{g.label}</div>
            {g.rows.map((r) => {
              index += 1
              const i = index
              const quote = quotes[r.symbol]
              const home = marketForSymbol(r.symbol)
              const inList = !!activeWatchlist?.symbols.includes(r.symbol)
              const isIndex = r.type === "INDEX"
              const where = isIndex ? "Index" : r.type === "ETF" ? `ETF${home ? ` · ${home.name}` : ""}` : (home?.name ?? "")
              const ex = exchangeName(r.exchange || quote?.exchange)
              return (
                <div
                  key={`${g.label}-${r.symbol}`}
                  id={`search-row-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => i !== active && setActive(i)}
                  className={cn("flex items-center gap-2 rounded-[14px] pr-1.5", i === active && "bg-selection")}
                >
                  <button
                    onClick={() => openResult(r)}
                    tabIndex={-1}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] py-2.5 pl-3 text-left outline-none"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fill text-label-2" aria-hidden>
                      {g.recent ? <Clock className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{nameOf(r)}</span>
                      <span className="truncate text-[12px] text-label-2">
                        {isIndex ? where : `${displaySymbol(r.symbol)}${where ? ` · ${where}` : ""}`}
                        {ex && !isIndex ? ` · ${ex}` : ""}
                      </span>
                    </span>
                    <span className="num flex shrink-0 flex-col items-end">
                      <span className="text-[14px] font-medium">{quote ? (isIndex ? formatPrice(quote.price, quote.currency) : formatMoney(quote.price, quote.currency)) : ""}</span>
                      <span className={cn("text-[12px] font-semibold", quote?.direction === "up" ? "text-up" : quote?.direction === "down" ? "text-down" : "text-label-2")}>
                        {quote ? formatPercent(quote.changePercent) : ""}
                      </span>
                    </span>
                  </button>
                  {isIndex ? (
                    <span className="h-8 w-8 shrink-0" aria-hidden />
                  ) : (
                    <button
                      onClick={() => addResult(r)}
                      aria-label={inList ? `${nameOf(r)} is in ${activeWatchlist?.name}` : `Add ${nameOf(r)} to ${activeWatchlist?.name ?? "watchlist"}`}
                      className={cn(
                        "press flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-tint/60",
                        inList ? "text-tint" : "text-label-2 hover:bg-fill hover:text-foreground",
                      )}
                    >
                      {inList ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {searching && <p className="px-3 py-8 text-center text-[13px] text-label-2">Searching…</p>}
        {!searching && q && rows.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-label-2">No matches for “{q}”. Try a company name or ticker.</p>}
      </div>

      <div className="hidden shrink-0 items-center gap-4 border-t border-separator px-5 py-2.5 text-[12px] text-label-2 sm:flex">
        <span>
          <kbd className="font-sans font-semibold">↵</kbd> open
        </span>
        <span>
          <kbd className="font-sans font-semibold">⌘↵</kbd> add to {activeWatchlist?.name ?? "watchlist"}
        </span>
        <span>
          <kbd className="font-sans font-semibold">↑↓</kbd> move
        </span>
        <span className="ml-auto">Data from Yahoo Finance</span>
      </div>
    </Sheet>
  )
}
