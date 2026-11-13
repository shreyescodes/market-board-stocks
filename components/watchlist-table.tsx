"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Search, X, Minus } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { Sparkline } from "./sparkline"
import { ChangePill, Glass, NumericText } from "./liquid-glass"
import type { Stock } from "@/lib/stock-types"
import { cn } from "@/lib/utils"

interface WatchlistTableProps {
  stocks: Stock[]
  selectedStockId: string | null
  onSelectStock: (id: string) => void
  onAddStock: (symbol: string, name: string) => void
  onRemoveStock: (id: string) => void
}

const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const

export function WatchlistTable({
  stocks,
  selectedStockId,
  onSelectStock,
  onAddStock,
  onRemoveStock,
}: WatchlistTableProps) {
  const [newSymbol, setNewSymbol] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ symbol: string; name: string; exchange: string }>>([])
  const addInputRef = useRef<HTMLInputElement>(null)

  // Debounced autocomplete against Yahoo Finance search
  useEffect(() => {
    if (!newSymbol.trim()) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks?action=search&query=${encodeURIComponent(newSymbol)}`)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.results || [])
        }
      } catch (e) {
        console.error("Suggestions fetch error:", e)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [newSymbol])

  const filteredStocks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return stocks
    return stocks.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
  }, [stocks, searchQuery])

  const closeAdd = () => {
    setNewSymbol("")
    setSuggestions([])
    setIsAdding(false)
  }

  const handleAddStock = (symbol = newSymbol, name = "") => {
    if (!symbol.trim()) return
    onAddStock(symbol.trim(), name)
    closeAdd()
  }

  return (
    <Glass className="flex h-full flex-col rounded-[28px] p-2.5">
      {/* Large title row */}
      <div className="flex items-center justify-between px-2.5 pb-3 pt-2">
        <div className="flex flex-col leading-none">
          <h2 className="display text-[26px] font-bold">Watchlist</h2>
          <span className="mt-1 text-[13px] text-label-2">
            {stocks.length} {stocks.length === 1 ? "symbol" : "symbols"}
          </span>
        </div>
        <button
          onClick={() => (isAdding ? closeAdd() : setIsAdding(true))}
          className={cn(
            "press flex h-9 w-9 items-center justify-center rounded-full",
            isAdding ? "bg-fill-hover" : "fill hover:bg-fill-hover",
          )}
          aria-label={isAdding ? "Cancel adding ticker" : "Add ticker"}
        >
          <motion.span animate={{ rotate: isAdding ? 45 : 0 }} transition={spring} className="flex">
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </motion.span>
        </button>
      </div>

      {/* Add ticker field */}
      <div className="relative z-30">
        <AnimatePresence initial={false}>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring}
              onAnimationComplete={() => addInputRef.current?.focus()}
              className="overflow-hidden px-0.5"
            >
              <div className="pb-2.5 pt-0.5">
                <div className="fill flex h-10 items-center gap-2 rounded-full pl-4 pr-1 focus-within:ring-2 focus-within:ring-tint/50">
                  <input
                    ref={addInputRef}
                    placeholder="Symbol or company, e.g. Netflix"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddStock()
                      if (e.key === "Escape") closeAdd()
                    }}
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-label-2"
                    maxLength={25}
                  />
                  <button
                    onClick={() => handleAddStock()}
                    disabled={!newSymbol.trim()}
                    className="press h-8 shrink-0 rounded-full bg-tint px-3.5 text-[13px] font-semibold text-white disabled:opacity-30"
                  >
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAdding && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={spring}
              className="glass glass-solid absolute left-0 top-[52px] z-50 max-h-[260px] w-full overflow-y-auto rounded-[22px] p-1.5"
            >
              {suggestions.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => handleAddStock(item.symbol, item.name)}
                  className="press flex w-full items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 text-left hover:bg-selection"
                >
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="text-[15px] font-semibold text-foreground">{item.symbol}</span>
                    <span className="truncate text-[12px] text-label-2">{item.name}</span>
                  </div>
                  <span className="fill shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-label-2">
                    {item.exchange}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search capsule */}
      <div className="fill relative mx-0.5 mb-2 flex h-9 items-center rounded-full pl-3 pr-2 focus-within:ring-2 focus-within:ring-tint/40">
        <Search className="h-4 w-4 shrink-0 text-label-2" />
        <input
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent pl-2 text-[15px] text-foreground outline-none placeholder:text-label-2"
        />
        <AnimatePresence>
          {searchQuery && (
            <motion.button
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              onClick={() => setSearchQuery("")}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/40 text-background"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" strokeWidth={3} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Rows */}
      <motion.div
        layoutScroll
        className="hide-scrollbar max-h-[440px] min-h-0 flex-1 overflow-y-auto lg:max-h-none"
      >
        <AnimatePresence initial={false}>
          {filteredStocks.length > 0 ? (
            filteredStocks.map((stock) => {
              const isSelected = selectedStockId === stock.id
              return (
                <motion.div
                  key={stock.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
                  transition={spring}
                  onClick={() => onSelectStock(stock.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectStock(stock.id)}
                  className="group relative flex cursor-pointer items-center gap-3 rounded-[18px] px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-tint/50"
                >
                  {isSelected && (
                    <motion.div layoutId="watch-lens" transition={spring} className="absolute inset-0 rounded-[18px] bg-selection" />
                  )}
                  {!isSelected && (
                    <div className="absolute inset-0 rounded-[18px] transition-colors duration-200 group-hover:bg-selection/50" />
                  )}

                  <div className="relative flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[15px] font-semibold">{stock.symbol}</span>
                    <span className="truncate text-[12px] text-label-2">{stock.name}</span>
                  </div>

                  <div className="pointer-events-none relative hidden shrink-0 sm:block lg:hidden xl:block">
                    <Sparkline data={stock.sparkline} direction={stock.direction} width={58} height={26} strokeWidth={1.5} />
                  </div>

                  <div className="relative flex shrink-0 flex-col items-end gap-1 leading-none">
                    <NumericText
                      value={stock.price}
                      format={(n) => n.toFixed(2)}
                      className="text-[15px] font-semibold text-foreground"
                    />
                    <ChangePill direction={stock.direction} className="min-w-[64px]">
                      {stock.changePercent >= 0 ? "+" : ""}
                      {stock.changePercent.toFixed(2)}%
                    </ChangePill>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveStock(stock.id)
                    }}
                    className="press relative -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-down text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    aria-label={`Remove ${stock.symbol}`}
                  >
                    <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                  </button>
                </motion.div>
              )
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center text-[13px] text-label-2"
            >
              {stocks.length === 0 ? "Loading watchlist…" : "No results"}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Glass>
  )
}
