"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, Plus, X } from "lucide-react"
import { Sparkline } from "./sparkline"
import { NumericText } from "./liquid-glass"
import { Sheet, SheetSearch } from "./sheet"
import { DEFAULT_INDICES, INDEX_CATALOG, MAX_INDICES, indexMeta, type IndexMeta } from "@/lib/indices"
import { DEFAULT_MARKET, MARKETS, getMarketStatus, marketById } from "@/lib/markets"
import { cn } from "@/lib/utils"

type IndexData = {
  symbol: string
  price: number
  change: number
  changePercent: number
  direction: "up" | "down" | "flat"
  sparkline: number[]
}

const INDICES_KEY = "marketboard.indices"
const MARKET_KEY = "marketboard.market"
const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const

function readStorage<T>(key: string, parse: (raw: string) => T | null, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return parse(raw) ?? fallback
  } catch {
    return fallback
  }
}
function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export function MarketBar() {
  const [now, setNow] = useState<Date | null>(null)
  const [marketId, setMarketId] = useState(DEFAULT_MARKET)
  const [selected, setSelected] = useState<string[]>(DEFAULT_INDICES)
  const [quotes, setQuotes] = useState<Record<string, IndexData>>({})
  const [failed, setFailed] = useState(false)
  const [indexPickerOpen, setIndexPickerOpen] = useState(false)
  const [marketPickerOpen, setMarketPickerOpen] = useState(false)

  // Restore saved choices after mount (localStorage is client-only)
  useEffect(() => {
    setSelected(
      readStorage(
        INDICES_KEY,
        (raw) => {
          const parsed = JSON.parse(raw)
          return Array.isArray(parsed)
            ? parsed.filter((s) => typeof s === "string" && indexMeta(s)).slice(0, MAX_INDICES)
            : null
        },
        DEFAULT_INDICES,
      ),
    )
    setMarketId(readStorage(MARKET_KEY, (raw) => (marketById(raw) ? raw : null), DEFAULT_MARKET))
  }, [])

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const selectedKey = selected.join(",")
  useEffect(() => {
    if (!selectedKey) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/stocks?action=quotes&symbols=${encodeURIComponent(selectedKey)}`)
        if (!res.ok) throw new Error("API error")
        const data = await res.json()
        if (cancelled) return
        if (!data.stocks?.length) throw new Error("No data")
        setQuotes((prev) => {
          const next = { ...prev }
          for (const s of data.stocks) next[s.symbol] = s
          return next
        })
        setFailed(false)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    load()
    const interval = setInterval(load, 12000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [selectedKey])

  const market = marketById(marketId) ?? MARKETS[0]
  const status = now ? getMarketStatus(market, now) : null

  const updateIndices = (next: string[]) => {
    setSelected(next)
    writeStorage(INDICES_KEY, JSON.stringify(next))
  }
  const removeIndex = (symbol: string) => updateIndices(selected.filter((s) => s !== symbol))
  const addIndex = (symbol: string) => {
    if (selected.includes(symbol) || selected.length >= MAX_INDICES) return
    updateIndices([...selected, symbol])
    setIndexPickerOpen(false)
  }
  const chooseMarket = (id: string) => {
    setMarketId(id)
    writeStorage(MARKET_KEY, id)
    setMarketPickerOpen(false)
  }
  const closeIndexPicker = useCallback(() => setIndexPickerOpen(false), [])
  const closeMarketPicker = useCallback(() => setMarketPickerOpen(false), [])

  const canAdd = selected.length < MAX_INDICES
  const cells = selected.length + (canAdd ? 1 : 0)

  return (
    <>
      <section className="hide-scrollbar overflow-x-auto rounded-[22px] bg-surface">
        <div
          className="grid divide-x divide-separator"
          style={{ gridTemplateColumns: `minmax(200px, 1fr) repeat(${cells}, minmax(170px, 1fr))` }}
        >
          {/* Market session — tap to switch exchange */}
          <button
            onClick={() => setMarketPickerOpen(true)}
            className="group flex flex-col justify-center px-5 py-4 text-left transition-colors hover:bg-selection/50"
            aria-label={`${market.name} market status. Change market`}
          >
            <span className="flex items-center gap-1 whitespace-nowrap text-[13px] text-label-2 group-hover:text-foreground">
              {market.name}
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-px" />
            </span>
            <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-[17px] font-semibold">
              <span className="relative flex h-2 w-2">
                {status && status.state !== "closed" && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ background: status.color }} />
                )}
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: status?.color ?? "var(--label-3)" }} />
              </span>
              {status?.label ?? "—"}
            </span>
            <span className="num mt-0.5 whitespace-nowrap text-[13px] text-label-2">
              {status ? `${status.detail}` : " "}
            </span>
            <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full transition-[width] duration-1000"
                style={{ width: `${(status?.progress ?? 0) * 100}%`, background: status?.color }}
              />
            </div>
          </button>

          <AnimatePresence initial={false} mode="popLayout">
            {selected.map((symbol) => (
              <motion.div
                key={symbol}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring}
              >
                <IndexCell meta={indexMeta(symbol)!} data={quotes[symbol]} failed={failed} onRemove={() => removeIndex(symbol)} />
              </motion.div>
            ))}

            {canAdd && (
              <motion.button
                key="add"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={spring}
                onClick={() => setIndexPickerOpen(true)}
                className="group flex flex-col items-center justify-center gap-2 px-5 py-4 text-label-2 transition-colors hover:bg-selection/50 hover:text-foreground"
              >
                <span className="fill flex h-9 w-9 items-center justify-center rounded-full transition-transform group-active:scale-95">
                  <Plus className="h-[18px] w-[18px]" />
                </span>
                <span className="text-[13px] font-medium">Add Index</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </section>

      <IndexPicker open={indexPickerOpen} selected={selected} onAdd={addIndex} onClose={closeIndexPicker} />
      <MarketPicker open={marketPickerOpen} now={now} current={market.id} onChoose={chooseMarket} onClose={closeMarketPicker} />
    </>
  )
}

function IndexCell({
  meta,
  data,
  failed,
  onRemove,
}: {
  meta: IndexMeta
  data?: IndexData
  failed: boolean
  onRemove: () => void
}) {
  const isUp = data?.direction === "up"
  const isDown = data?.direction === "down"
  return (
    <div className="group relative flex h-full items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 flex-col">
        <span className="truncate pr-6 text-[13px] text-label-2">{meta.name}</span>
        {data ? (
          <>
            <NumericText
              value={data.price}
              format={(n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              className="mt-1 text-[17px] font-semibold"
            />
            <span
              className={cn(
                "num mt-0.5 whitespace-nowrap text-[13px] font-medium",
                isUp && "text-up",
                isDown && "text-down",
                !isUp && !isDown && "text-label-2",
              )}
            >
              {data.change >= 0 ? "+" : ""}
              {data.change.toFixed(2)} ({data.changePercent >= 0 ? "+" : ""}
              {data.changePercent.toFixed(2)}%)
            </span>
          </>
        ) : failed ? (
          <span className="mt-1 text-[13px] text-label-3">Unavailable</span>
        ) : (
          <>
            <div className="mt-2 h-4 w-24 animate-pulse rounded-full bg-fill" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded-full bg-fill" />
          </>
        )}
      </div>

      {data && (
        <div className="hidden shrink-0 xl:block">
          <Sparkline data={data.sparkline} direction={data.direction} width={64} height={30} strokeWidth={1.5} />
        </div>
      )}

      <button
        onClick={onRemove}
        className="press absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-fill text-label-2 opacity-0 transition-opacity hover:bg-fill-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        aria-label={`Remove ${meta.name}`}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  )
}

function IndexPicker({
  open,
  selected,
  onAdd,
  onClose,
}: {
  open: boolean
  selected: string[]
  onAdd: (symbol: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const full = selected.length >= MAX_INDICES
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = INDEX_CATALOG.filter(
      (i) => !q || i.name.toLowerCase().includes(q) || i.country.toLowerCase().includes(q) || i.symbol.toLowerCase().includes(q),
    )
    return (["Americas", "Europe", "Asia-Pacific"] as const)
      .map((region) => ({ region, items: list.filter((i) => i.region === region) }))
      .filter((g) => g.items.length)
  }, [query])

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add Index"
      subtitle={`${selected.length} of ${MAX_INDICES} shown${full ? " · remove one to add another" : ""}`}
    >
      <SheetSearch value={query} onChange={setQuery} placeholder="Search indexes or countries" />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g) => (
          <div key={g.region} className="pt-2">
            <div className="px-3 pb-1 text-[12px] font-semibold text-label-2">{g.region}</div>
            {g.items.map((item) => {
              const isOn = selected.includes(item.symbol)
              const disabled = isOn || full
              return (
                <button
                  key={item.symbol}
                  disabled={disabled}
                  onClick={() => onAdd(item.symbol)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors",
                    !disabled && "hover:bg-selection active:bg-selection",
                    disabled && !isOn && "opacity-40",
                  )}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[15px] font-medium">{item.name}</span>
                    <span className="text-[12px] text-label-2">
                      {item.country} · {item.symbol}
                    </span>
                  </div>
                  {isOn ? (
                    <Check className="h-[18px] w-[18px] shrink-0 text-tint" strokeWidth={2.5} />
                  ) : (
                    !full && <Plus className="h-[18px] w-[18px] shrink-0 text-label-2" />
                  )}
                </button>
              )
            })}
          </div>
        ))}
        {groups.length === 0 && <div className="py-10 text-center text-[13px] text-label-2">No matching indexes</div>}
      </div>
    </Sheet>
  )
}

function MarketPicker({
  open,
  now,
  current,
  onChoose,
  onClose,
}: {
  open: boolean
  now: Date | null
  current: string
  onChoose: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const rows = useMemo(() => {
    if (!now) return []
    return MARKETS.map((m) => ({ market: m, status: getMarketStatus(m, now) }))
  }, [now])

  const openCount = rows.filter((r) => r.status.state === "open").length
  const q = query.trim().toLowerCase()
  const groups = (["Americas", "Europe", "Middle East & Africa", "Asia-Pacific"] as const)
    .map((region) => ({
      region,
      items: rows.filter(
        (r) =>
          r.market.region === region &&
          (!q ||
            r.market.name.toLowerCase().includes(q) ||
            r.market.city.toLowerCase().includes(q) ||
            r.market.exchange.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.items.length)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="World Markets"
      subtitle={`${openCount} of ${MARKETS.length} open now · regular hours, holidays not included`}
    >
      <SheetSearch value={query} onChange={setQuery} placeholder="Search countries, cities or exchanges" />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g) => (
          <div key={g.region} className="pt-2">
            <div className="px-3 pb-1 text-[12px] font-semibold text-label-2">{g.region}</div>
            {g.items.map(({ market, status }) => {
              const isCurrent = market.id === current
              return (
                <button
                  key={market.id}
                  onClick={() => onChoose(market.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-selection active:bg-selection",
                    isCurrent && "bg-selection",
                  )}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 text-[15px] font-medium">
                      {market.name}
                      {isCurrent && <Check className="h-4 w-4 text-tint" strokeWidth={2.5} />}
                    </span>
                    <span className="truncate text-[12px] text-label-2">
                      {market.exchange} · {market.city} · <span className="num">{status.localTime}</span>
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: status.state === "closed" ? "var(--label-2)" : status.color }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                      {status.label}
                    </span>
                    <span className="num text-[12px] text-label-2">{status.detail}</span>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
        {groups.length === 0 && <div className="py-10 text-center text-[13px] text-label-2">No matching markets</div>}
      </div>
    </Sheet>
  )
}
