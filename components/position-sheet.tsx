"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Sheet } from "./sheet"
import { useWorkspace } from "./workspace"
import { fetchQuotes } from "@/lib/stock-data"
import { formatPrice } from "@/lib/format"
import type { Stock } from "@/lib/stock-types"
import { cn } from "@/lib/utils"

export type PositionDraft = { id?: string; symbol?: string; shares?: number; cost?: number }

type Suggestion = { symbol: string; name: string; exchange: string }

export function PositionSheet({ open, initial, onClose }: { open: boolean; initial: PositionDraft | null; onClose: () => void }) {
  const { workspace, savePosition } = useWorkspace()
  const editing = !!initial?.id
  const [symbol, setSymbol] = useState("")
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [shares, setShares] = useState("")
  const [cost, setCost] = useState("")
  const [quote, setQuote] = useState<Stock | null>(null)
  const [lookup, setLookup] = useState<"idle" | "loading" | "missing" | "error">("idle")
  const [submitted, setSubmitted] = useState(false)

  // Reset the form each time the sheet opens
  useEffect(() => {
    if (!open) return
    setSymbol(initial?.symbol ?? "")
    setQuery("")
    setSuggestions([])
    setShares(initial?.shares != null ? String(initial.shares) : "")
    setCost(initial?.cost != null ? String(initial.cost) : "")
    setQuote(null)
    setLookup("idle")
    setSubmitted(false)
  }, [open, initial])

  // Symbol search (only when no symbol is chosen yet)
  useEffect(() => {
    if (symbol || !query.trim()) {
      setSuggestions([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks?action=search&query=${encodeURIComponent(query.trim())}`)
        if (res.ok) setSuggestions((await res.json()).results ?? [])
      } catch {}
    }, 250)
    return () => clearTimeout(t)
  }, [query, symbol])

  // Look up the live quote for the chosen symbol (price, currency) and prefill the cost
  useEffect(() => {
    if (!symbol) return
    let active = true
    setLookup("loading")
    fetchQuotes([symbol]).then((r) => {
      if (!active) return
      if (!r) return setLookup("error")
      const q = r.stocks.find((s) => s.symbol === symbol)
      if (!q) return setLookup("missing")
      setQuote(q)
      setLookup("idle")
      setCost((c) => (c === "" ? String(Number(q.price.toFixed(q.price < 1 ? 4 : 2))) : c))
    })
    return () => {
      active = false
    }
  }, [symbol])

  const sharesNum = Number(shares)
  const costNum = Number(cost)
  const errors = useMemo(
    () => ({
      symbol: !symbol ? "Choose a symbol" : lookup === "missing" ? `No quote found for ${symbol}` : null,
      shares: !shares.trim() || !Number.isFinite(sharesNum) || sharesNum <= 0 ? "Enter a number of shares above 0" : null,
      cost: !cost.trim() || !Number.isFinite(costNum) || costNum < 0 ? "Enter an average cost of 0 or more" : null,
    }),
    [symbol, lookup, shares, cost, sharesNum, costNum],
  )
  const valid = !errors.symbol && !errors.shares && !errors.cost && lookup !== "loading"

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!valid) return
    const existing = workspace?.positions.find((p) => p.symbol === symbol && p.id !== initial?.id)
    if (!editing && existing) {
      // Same symbol already held: merge into one position at the weighted average cost
      const total = existing.shares + sharesNum
      const avg = (existing.shares * existing.cost + sharesNum * costNum) / total
      savePosition({ id: existing.id, symbol, shares: total, cost: Number(avg.toFixed(6)) })
      toast.success(`Added to your ${symbol} position · ${total.toLocaleString("en-US")} shares`)
    } else {
      savePosition({ id: initial?.id, symbol, shares: sharesNum, cost: costNum })
      toast.success(editing ? `Updated ${symbol}` : `Added ${symbol} to your portfolio`)
    }
    onClose()
  }

  const currency = quote?.currency ?? ""
  const field = "fill h-11 w-full rounded-[14px] px-3.5 text-[15px] outline-none focus:ring-2 focus:ring-tint/50"

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${initial?.symbol}` : "Add Position"}
      subtitle="Stored only in this browser"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 overflow-y-auto px-5 pb-5 pt-2" noValidate>
        {/* Symbol */}
        <div className="relative flex flex-col gap-1.5">
          <label htmlFor="pos-symbol" className="text-[13px] font-medium text-label-2">
            Symbol
          </label>
          {symbol ? (
            <div className="fill flex h-11 items-center justify-between rounded-[14px] px-3.5">
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-[15px] font-semibold">{symbol}</span>
                <span className="truncate text-[12px] text-label-2">
                  {lookup === "loading"
                    ? "Looking up…"
                    : lookup === "missing"
                      ? "No quote found"
                      : lookup === "error"
                        ? "Couldn't reach market data"
                        : quote
                          ? `${quote.name} · ${formatPrice(quote.price)} ${currency}`
                          : ""}
                </span>
              </div>
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setSymbol("")
                    setQuote(null)
                    setCost("")
                  }}
                  className="press shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold text-tint"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <>
              <input
                id="pos-symbol"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbol or company"
                autoComplete="off"
                className={field}
              />
              {suggestions.length > 0 && (
                <ul className="glass glass-solid absolute left-0 top-[72px] z-10 max-h-[240px] w-full overflow-y-auto rounded-[18px] p-1.5">
                  {suggestions.map((s) => (
                    <li key={s.symbol}>
                      <button
                        type="button"
                        onClick={() => setSymbol(s.symbol.toUpperCase())}
                        className="flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-left hover:bg-selection"
                      >
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="text-[15px] font-semibold">{s.symbol}</span>
                          <span className="truncate text-[12px] text-label-2">{s.name}</span>
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold uppercase text-label-2">{s.exchange}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {submitted && errors.symbol && <span className="text-[12px] text-down">{errors.symbol}</span>}
        </div>

        {/* Shares and cost */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pos-shares" className="text-[13px] font-medium text-label-2">
              Shares
            </label>
            <input
              id="pos-shares"
              inputMode="decimal"
              value={shares}
              onChange={(e) => setShares(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className={cn(field, "num")}
            />
            {submitted && errors.shares && <span className="text-[12px] text-down">{errors.shares}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pos-cost" className="text-[13px] font-medium text-label-2">
              Avg cost per share{currency ? ` (${currency})` : ""}
            </label>
            <input
              id="pos-cost"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className={cn(field, "num")}
            />
            {submitted && errors.cost && <span className="text-[12px] text-down">{errors.cost}</span>}
          </div>
        </div>

        {quote && Number.isFinite(sharesNum) && sharesNum > 0 && (
          <p className="num text-[13px] text-label-2">
            Market value now: {formatPrice(sharesNum * quote.price)} {currency}
          </p>
        )}

        <button
          type="submit"
          disabled={lookup === "loading"}
          className="press h-11 rounded-full bg-tint-fill text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {editing ? "Save Changes" : "Add Position"}
        </button>
      </form>
    </Sheet>
  )
}
