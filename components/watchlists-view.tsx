"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Plus, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { WatchlistTable, type WatchlistRow } from "./watchlist-table"
import { WatchlistsSheet } from "./watchlists-sheet"
import { StockDetails } from "./stock-details"
import { PageTitle } from "./markets-view"
import { useFeed, useWorkspace } from "./workspace"
import { useQuotes } from "@/hooks/use-quotes"
import { useSparks } from "@/hooks/use-sparks"
import { fetchQuotes } from "@/lib/stock-data"
import type { Stock } from "@/lib/stock-types"
import type { Watchlist } from "@/lib/storage"
import { cn } from "@/lib/utils"

export function WatchlistsView() {
  const { ready, workspace, activeWatchlist, setActiveWatchlist, addSymbol, removeSymbol, insertSymbol } = useWorkspace()
  const { feed } = useFeed()
  const lists = useMemo(() => workspace?.watchlists ?? [], [workspace])
  const symbols = useMemo(() => activeWatchlist?.symbols ?? [], [activeWatchlist])
  // Every list's symbols, so each list can show how it is doing today
  const allSymbols = useMemo(() => [...new Set(lists.flatMap((l) => l.symbols))], [lists])
  const { quotes } = useQuotes(allSymbols, 10_000, { enabled: ready })
  const sparks = useSparks(symbols, ready)
  const [picked, setPicked] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)
  const detailRef = useRef<HTMLElement>(null)

  // Keep a valid selection when switching lists or removing the selected symbol
  const selected = picked && symbols.includes(picked) ? picked : (symbols[0] ?? null)

  const selectSymbol = useCallback((symbol: string) => {
    setPicked(symbol)
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

  const rows: WatchlistRow[] = symbols.map((s) => ({ symbol: s, stock: quotes[s], spark: sparks[s] }))
  const selectedStock = selected ? quotes[selected] : undefined

  return (
    <div className="flex flex-col gap-5 pb-4">
      <PageTitle title="Watchlists" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] xl:grid-cols-[220px_minmax(340px,400px)_minmax(0,1fr)]">
        <ListsPanel
          lists={lists}
          activeId={activeWatchlist?.id}
          quotes={quotes}
          onSelect={setActiveWatchlist}
          onManage={() => setManaging(true)}
          className="lg:col-span-2 xl:col-span-1"
        />

        <aside className="lg:sticky lg:top-[76px] lg:h-[calc(100vh-92px)] lg:self-start">
          <WatchlistTable
            rows={rows}
            loaded={ready}
            feedStatus={feed.status}
            listName={activeWatchlist?.name ?? "Watchlist"}
            selectedSymbol={selected}
            onSelectStock={selectSymbol}
            onAddStock={addStock}
            onRemoveStock={removeStock}
          />
        </aside>

        <section ref={detailRef} className="min-w-0 scroll-mt-[76px]">
          {selectedStock ? (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end">
                <Link
                  href={`/symbol/${encodeURIComponent(selectedStock.symbol)}`}
                  className="press fill flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold outline-none hover:bg-fill-hover focus-visible:ring-2 focus-visible:ring-tint/60"
                >
                  Open page <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              <StockDetails stock={selectedStock} />
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-1 rounded-[22px] bg-surface text-center">
              <span className="text-[17px] font-semibold">
                {!selected ? "This watchlist is empty" : feed.status === "offline" ? "Market data unavailable" : "Loading quote…"}
              </span>
              <span className="text-[13px] text-label-2">
                {!selected
                  ? "Tap + to add a symbol, or use search (⌘K)."
                  : feed.status === "offline"
                    ? "Yahoo Finance can't be reached right now. Retrying automatically."
                    : "Fetching the latest price from Yahoo Finance."}
              </span>
            </div>
          )}
        </section>
      </div>

      <WatchlistsSheet open={managing} onClose={() => setManaging(false)} />
    </div>
  )
}

/* Your lists: a column on wide screens, a row of chips above the list on smaller ones */
function ListsPanel({
  lists,
  activeId,
  quotes,
  onSelect,
  onManage,
  className,
}: {
  lists: Watchlist[]
  activeId?: string
  quotes: Record<string, Stock>
  onSelect: (id: string) => void
  onManage: () => void
  className?: string
}) {
  const today = (l: Watchlist) => {
    const qs = l.symbols.map((s) => quotes[s]).filter(Boolean) as Stock[]
    return { up: qs.filter((q) => q.direction === "up").length, down: qs.filter((q) => q.direction === "down").length, known: qs.length }
  }
  return (
    <nav aria-label="Your lists" className={cn("flex min-w-0 flex-col gap-2 rounded-[22px] bg-surface p-2.5 xl:self-start", className)}>
      <div className="flex items-center justify-between px-2.5 pt-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-label-2">Your lists</span>
        <button
          onClick={onManage}
          aria-label="Rename or delete lists"
          className="press flex h-7 w-7 items-center justify-center rounded-full text-label-2 outline-none hover:bg-fill hover:text-foreground focus-visible:ring-2 focus-visible:ring-tint/60"
        >
          <Settings2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="hide-scrollbar flex gap-1.5 overflow-x-auto xl:flex-col xl:gap-0.5 xl:overflow-visible">
        {lists.map((l) => {
          const active = l.id === activeId
          const t = today(l)
          return (
            <li key={l.id} className="shrink-0">
              <button
                onClick={() => onSelect(l.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "press flex w-full min-w-[150px] flex-col gap-0.5 rounded-[14px] px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-tint/60",
                  active ? "bg-selection" : "hover:bg-selection/50",
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] font-semibold">{l.name}</span>
                  <span className="num shrink-0 text-[13px] text-label-2">{l.symbols.length}</span>
                </span>
                <span className="num text-[12px] text-label-2">
                  {t.known ? (
                    <>
                      <span className="text-up">{t.up} up</span> · <span className="text-down">{t.down} down</span> today
                    </>
                  ) : l.symbols.length ? (
                    "…"
                  ) : (
                    "Empty"
                  )}
                </span>
              </button>
            </li>
          )
        })}
        <li className="shrink-0">
          <button
            onClick={onManage}
            className="press flex h-full min-h-[44px] items-center gap-1.5 rounded-[14px] px-3 text-[14px] font-semibold text-tint outline-none hover:bg-selection/50 focus-visible:ring-2 focus-visible:ring-tint/60"
          >
            <Plus className="h-4 w-4" aria-hidden /> New list
          </button>
        </li>
      </ul>
      <p className="hidden px-2.5 pb-1 text-[11px] leading-snug text-label-2 xl:block">Lists are saved in this browser.</p>
    </nav>
  )
}
