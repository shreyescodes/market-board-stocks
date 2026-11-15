"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Download, Ellipsis, Pencil, Plus, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { PageTitle } from "./markets-view"
import { PositionSheet, type PositionDraft } from "./position-sheet"
import { Sheet } from "./sheet"
import { useWorkspace } from "./workspace"
import { useMarket } from "./market-context"
import { Segmented } from "./segmented"
import { profileFor } from "@/lib/market-profiles"
import { exchangeName } from "@/lib/markets"
import { useQuotes } from "@/hooks/use-quotes"
import { allocation, fxSymbol, majorCurrency, valuePortfolio, type HoldingRow } from "@/lib/portfolio"
import { fetchProfiles, type Profile } from "@/lib/stock-data"
import { fromBackup, toBackup, type Workspace } from "@/lib/storage"
import { displaySymbol, formatMoney, formatPercent, formatSignedMoney, formatTimeIn, shortName } from "@/lib/format"
import { cn } from "@/lib/utils"

const ALLOC_COLORS = ["var(--tint)", "#af52de", "#32ade6", "#ff9f0a", "#30b0c7", "#a2845e"]
const tone = (n?: number | null) => (n == null || Math.abs(n) < 0.005 ? "text-label-2" : n > 0 ? "text-up" : "text-down")

export function PortfolioView() {
  const { ready, workspace, removePosition, restorePosition, replaceWorkspace } = useWorkspace()
  const positions = useMemo(() => workspace?.positions ?? [], [workspace])
  const [draft, setDraft] = useState<PositionDraft | null>(null)
  const [importing, setImporting] = useState<Workspace | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tab, setTab] = useState<"holdings" | "allocation">("holdings")

  // Totals follow the market lens (INR for India), with USD one tap away
  const { market } = useMarket()
  const local = profileFor(market.id).currency
  const [inUsd, setInUsd] = useState(false)
  const base = inUsd || local === "USD" ? "USD" : local
  const usd = (n?: number | null) => formatMoney(n, base)
  const signedUsd = (n?: number | null) => formatSignedMoney(n, base)

  // Quotes for holdings, plus FX rates for every non-USD currency they trade in
  const holdingSymbols = useMemo(() => [...new Set(positions.map((p) => p.symbol))], [positions])
  // One batched request: once a holding's currency is known, its FX rate joins the same request
  const { quotes } = useQuotes(holdingSymbols, 10_000, {
    enabled: ready,
    related: (latest) => {
      const codes = new Set(holdingSymbols.map((s) => latest[s]).filter(Boolean).map((q) => majorCurrency(q!.currency).code))
      return [...codes].map((c) => fxSymbol(c, base)).filter((s): s is string => !!s)
    },
  })

  // Cheap enough to compute each render, and it follows the base currency switch
  const summary = valuePortfolio(positions, quotes, base)

  // Sector/country profiles change rarely; fetch once per set of holdings
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const profileKey = holdingSymbols.join(",")
  useEffect(() => {
    // Keyed on the joined symbols, so unrelated workspace edits don't refetch
    if (!profileKey) return
    let active = true
    fetchProfiles(profileKey.split(",")).then((p) => active && p && setProfiles((prev) => ({ ...prev, ...p })))
    return () => {
      active = false
    }
  }, [profileKey])

  const valued = summary.rows.filter((r) => r.value != null)
  const byHolding = allocation(valued.map((r) => ({ label: r.position.symbol, value: r.value! })))
  const bySector = allocation(
    valued.map((r) => {
      const p = profiles[r.position.symbol]
      const label = p?.sector ?? (p && p.quoteType && p.quoteType !== "EQUITY" ? "Funds & ETFs" : p ? "Unclassified" : "Loading…")
      return { label, value: r.value! }
    }),
  )
  const byCurrency = allocation(valued.map((r) => ({ label: r.baseCode, value: r.value! })))

  const remove = (row: HoldingRow) => {
    const removed = removePosition(row.position.id)
    if (!removed) return
    toast(`Removed ${removed.symbol}`, { action: { label: "Undo", onClick: () => restorePosition(removed) } })
  }

  const exportBackup = () => {
    if (!workspace) return
    const blob = new Blob([JSON.stringify(toBackup(workspace), null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `marketboard-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Backup downloaded")
  }

  const onFile = async (file?: File) => {
    if (!file) return
    try {
      setImporting(fromBackup(await file.text()))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }


  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageTitle
        title="Portfolio"
        subtitle={`Values in ${base} at live exchange rates`}
        actions={
          <>
            {local !== "USD" && (
              <Segmented
                label="Show values in"
                size="sm"
                value={inUsd ? "USD" : local}
                onChange={(v) => setInUsd(v === "USD")}
                options={[
                  { value: local, label: local },
                  { value: "USD", label: "USD" },
                ]}
              />
            )}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="More: export or import a backup"
                className="press fill flex h-9 w-9 items-center justify-center rounded-full outline-none hover:bg-fill-hover focus-visible:ring-2 focus-visible:ring-tint/60"
              >
                <Ellipsis className="h-4 w-4" aria-hidden />
              </button>
              {menuOpen && (
                <div className="glass glass-solid absolute right-0 top-11 z-30 flex w-[200px] flex-col rounded-[18px] p-1.5" role="menu">
                  <button role="menuitem" onClick={() => { setMenuOpen(false); exportBackup() }} className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[14px] hover:bg-selection" disabled={!workspace}>
                    <Download className="h-4 w-4" aria-hidden /> Export backup
                  </button>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); fileRef.current?.click() }} className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[14px] hover:bg-selection">
                    <Upload className="h-4 w-4" aria-hidden /> Import backup
                  </button>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <button
              onClick={() => setDraft({})}
              className="press flex h-9 items-center gap-1.5 rounded-full bg-tint-fill px-4 text-[13px] font-semibold text-white"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add Position
            </button>
          </>
        }
      />

      {!ready ? null : positions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[22px] bg-surface px-6 py-16 text-center">
          <h2 className="text-[20px] font-semibold">Track your holdings</h2>
          <p className="max-w-[420px] text-[14px] text-label-2">
            Add the stocks and funds you own to see their value, today&apos;s gain or loss, total return and allocation, all in your market&apos;s currency.
          </p>
          <button
            onClick={() => setDraft({})}
            className="press mt-3 flex h-10 items-center gap-1.5 rounded-full bg-tint-fill px-5 text-[14px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add Your First Position
          </button>
        </div>
      ) : (
        <>
          {/* Summary: three numbers, then where the money is */}
          <section aria-label="Portfolio summary" className="flex flex-col gap-5 rounded-[24px] bg-surface p-5 md:p-6">
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div className="flex min-w-[220px] flex-[1.4] flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-label-2">Value</span>
                <span className="num display whitespace-nowrap text-[36px] font-bold leading-tight">{usd(summary.value)}</span>
                <span className="text-[12px] text-label-2">
                  {valued.length} of {positions.length} holdings valued
                </span>
              </div>
              <div className="flex min-w-[150px] flex-1 flex-col gap-0.5 border-separator md:border-l md:pl-6">
                <span className="text-[13px] font-semibold text-label-2">Today</span>
                <span className={cn("num whitespace-nowrap text-[21px] font-bold lg:text-[24px]", tone(summary.dayPnl))}>{signedUsd(summary.dayPnl)}</span>
                <span className={cn("num text-[14px] font-semibold", tone(summary.dayPnl))}>{formatPercent(summary.dayPct)}</span>
              </div>
              <div className="flex min-w-[150px] flex-1 flex-col gap-0.5 border-separator md:border-l md:pl-6">
                <span className="text-[13px] font-semibold text-label-2">Total return</span>
                <span className={cn("num whitespace-nowrap text-[21px] font-bold lg:text-[24px]", tone(summary.totalPnl))}>{signedUsd(summary.totalPnl)}</span>
                <span className="num text-[14px] text-label-2">
                  <span className={cn("font-semibold", tone(summary.totalPnl))}>{formatPercent(summary.totalPct)}</span> on {usd(summary.costBasis)} cost
                </span>
              </div>
            </div>
            {byHolding.length > 0 && (
              <div className="flex flex-col gap-2.5 border-t border-separator pt-4">
                <div role="img" aria-label={`Allocation: ${byHolding.map((h) => `${h.label} ${h.pct.toFixed(1)}%`).join(", ")}`} className="flex h-2.5 gap-[3px]">
                  {byHolding.map((h, i) => (
                    <span key={h.label} className="rounded-full" style={{ flex: h.pct, background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                  ))}
                </div>
                <div className="num flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  {byHolding.map((h, i) => (
                    <span key={h.label} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} aria-hidden />
                      {displaySymbol(h.label)} {h.pct.toFixed(1)}%
                    </span>
                  ))}
                  <span className="text-label-2 md:ml-auto">Currency exposure: {byCurrency.map((c) => `${c.label} ${c.pct.toFixed(1)}%`).join(" · ")}</span>
                </div>
              </div>
            )}
          </section>

          {summary.excluded > 0 && (
            <p role="status" className="rounded-[16px] bg-surface px-4 py-3 text-[13px] text-label-2">
              <span className="font-semibold text-warn">Not in totals: </span>
              {summary.rows
                .filter((r) => r.issue)
                .map((r) => `${r.position.symbol} (${r.issue === "no-quote" ? "no quote yet" : `no ${r.baseCode}→${base} rate`})`)
                .join(", ")}
              . MarketBoard never estimates missing prices.
            </p>
          )}

          <div className="flex items-center justify-between gap-2 px-1">
            <Segmented
              label="Portfolio view"
              value={tab}
              onChange={setTab}
              options={[
                { value: "holdings", label: "Holdings" },
                { value: "allocation", label: "Allocation" },
              ]}
            />
            <span className="num text-[12px] text-label-2">{summary.asOf ? `Latest price ${formatTimeIn(summary.asOf, null)}, your time` : ""}</span>
          </div>

          {/* Holdings */}
          {tab === "holdings" && (
          <section aria-labelledby="holdings" className="rounded-[22px] bg-surface p-4">
            <h2 id="holdings" className="sr-only">
              Holdings
            </h2>

            {/* Table on wide screens */}
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[820px] text-[14px]">
                <thead>
                  <tr className="border-b border-separator text-left text-[12px] text-label-2">
                    <th className="px-2 py-2 font-medium">Holding</th>
                    <th className="px-2 py-2 text-right font-medium">Shares</th>
                    <th className="px-2 py-2 text-right font-medium">Avg Cost</th>
                    <th className="px-2 py-2 text-right font-medium">Price</th>
                    <th className="px-2 py-2 text-right font-medium">Value ({base})</th>
                    <th className="px-2 py-2 text-right font-medium">Day&apos;s P&amp;L</th>
                    <th className="px-2 py-2 text-right font-medium">Total P&amp;L</th>
                    <th className="px-2 py-2 text-right font-medium">Weight</th>
                    <th className="w-[72px] px-2 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr key={r.position.id} className="group border-b border-separator last:border-b-0">
                      <td className="px-2 py-2.5">
                        <Link href={`/symbol/${encodeURIComponent(r.position.symbol)}`} className="flex flex-col leading-tight hover:underline">
                          <span className="flex items-center gap-1.5">
                            <span className="max-w-[220px] truncate font-semibold">{r.quote ? shortName(r.quote.name) : r.position.symbol}</span>
                            {r.quote?.exchange && <span className="rounded-[4px] bg-fill px-1 py-px text-[9px] font-bold uppercase text-label-2">{exchangeName(r.quote.exchange)}</span>}
                          </span>
                          <span className="text-[12px] text-label-2">{displaySymbol(r.position.symbol)}</span>
                        </Link>
                      </td>
                      <td className="num px-2 py-2.5 text-right">{r.position.shares.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                      <td className="num px-2 py-2.5 text-right">
                        {r.quote ? formatMoney(r.position.cost, r.quote.currency) : r.position.cost}
                      </td>
                      <td className="num px-2 py-2.5 text-right">{r.quote ? formatMoney(r.quote.price, r.quote.currency) : "—"}</td>
                      <td className="num px-2 py-2.5 text-right font-semibold">{usd(r.value)}</td>
                      <td className={cn("num px-2 py-2.5 text-right", tone(r.dayPnl))}>
                        {signedUsd(r.dayPnl)}
                        <span className="block text-[12px]">{formatPercent(r.dayPct)}</span>
                      </td>
                      <td className={cn("num px-2 py-2.5 text-right", tone(r.totalPnl))}>
                        {signedUsd(r.totalPnl)}
                        <span className="block text-[12px]">{formatPercent(r.totalPct)}</span>
                      </td>
                      <td className="num px-2 py-2.5 text-right">{r.weight != null ? `${r.weight.toFixed(1)}%` : "—"}</td>
                      <td className="px-2 py-2.5">
                        <RowActions row={r} onEdit={() => setDraft({ ...r.position })} onRemove={() => remove(r)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards on phones and tablets */}
            <ul className="lg:hidden">
              {summary.rows.map((r) => (
                <li key={r.position.id} className="border-b border-separator py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/symbol/${encodeURIComponent(r.position.symbol)}`} className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-[15px] font-semibold">{r.quote ? shortName(r.quote.name) : r.position.symbol}</span>
                      <span className="truncate text-[12px] text-label-2">
                        {displaySymbol(r.position.symbol)} · {r.position.shares.toLocaleString("en-US", { maximumFractionDigits: 6 })} sh · avg{" "}
                        {r.quote ? formatMoney(r.position.cost, r.quote.currency) : r.position.cost}
                      </span>
                    </Link>
                    <div className="flex shrink-0 flex-col items-end leading-tight">
                      <span className="num text-[15px] font-semibold">{usd(r.value)}</span>
                      <span className={cn("num text-[12px]", tone(r.totalPnl))}>
                        {signedUsd(r.totalPnl)} ({formatPercent(r.totalPct)})
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className={cn("num text-[12px]", tone(r.dayPnl))}>
                      Day {signedUsd(r.dayPnl)} · {r.weight != null ? `${r.weight.toFixed(1)}% of portfolio` : "—"}
                    </span>
                    <RowActions row={r} onEdit={() => setDraft({ ...r.position })} onRemove={() => remove(r)} alwaysVisible />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          )}

          {/* Allocation */}
          {tab === "allocation" && (
            <section aria-label="Allocation" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MeterList title="By Holding" items={byHolding} />
              <MeterList title="By Sector" items={bySector} />
              <MeterList title="By Currency" items={byCurrency} />
            </section>
          )}

          <p className="px-1 text-[12px] leading-relaxed text-label-2">
            Day&apos;s P&amp;L includes currency moves. Cost basis is converted to {base} at today&apos;s exchange rate, not the rate
            when you bought. Positions are stored only in this browser — use Export to keep a backup. MarketBoard is a tracker,
            not a brokerage.
          </p>
        </>
      )}

      <PositionSheet open={draft !== null} initial={draft} onClose={() => setDraft(null)} />

      <Sheet open={importing !== null} onClose={() => setImporting(null)} title="Import Backup" subtitle="This replaces what's in this browser">
        <div className="flex flex-col gap-4 px-5 pb-5 pt-2">
          <p className="text-[14px] text-label-2">
            The backup contains {importing?.watchlists.length ?? 0} watchlist{importing?.watchlists.length === 1 ? "" : "s"} and{" "}
            {importing?.positions.length ?? 0} position{importing?.positions.length === 1 ? "" : "s"}. Your current watchlists and portfolio
            will be replaced. Export first if you want to keep them.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setImporting(null)} className="press fill h-11 flex-1 rounded-full text-[15px] font-semibold hover:bg-fill-hover">
              Cancel
            </button>
            <button
              onClick={() => {
                if (importing) replaceWorkspace(importing)
                setImporting(null)
                toast.success("Backup imported")
              }}
              className="press h-11 flex-1 rounded-full bg-down-fill text-[15px] font-semibold text-white"
            >
              Replace
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

function RowActions({ row, onEdit, onRemove, alwaysVisible }: { row: HoldingRow; onEdit: () => void; onRemove: () => void; alwaysVisible?: boolean }) {
  const btn = cn(
    "press flex h-9 w-9 md:h-7 md:w-7 items-center justify-center rounded-full bg-fill text-label-2 transition-opacity hover:bg-fill-hover hover:text-foreground focus-visible:opacity-100",
    !alwaysVisible && "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
  )
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button onClick={onEdit} className={btn} aria-label={`Edit ${row.position.symbol}`}>
        <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
      </button>
      <button onClick={onRemove} className={btn} aria-label={`Remove ${row.position.symbol}`}>
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  )
}

/* Ranked horizontal bars, one hue, largest first: name, bar and share on each row */
function MeterList({ title, items }: { title: string; items: { label: string; value: number; pct: number }[] }) {
  return (
    <div className="rounded-[22px] bg-surface p-4">
      <h3 className="px-1 pb-3 text-[17px] font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="px-1 py-6 text-center text-[13px] text-label-2">No valued holdings yet</p>
      ) : (
        <ul className="flex flex-col gap-3 px-1">
          {items.map((i) => (
            <li key={i.label} title={`${i.label}: ${formatMoney(i.value, "USD")} (${i.pct.toFixed(1)}%)`}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate font-medium">{i.label}</span>
                <span className="num shrink-0 text-label-2">
                  {i.pct.toFixed(1)}% · {formatMoney(i.value, "USD", { compact: true })}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-[4px] bg-fill" aria-hidden>
                <div className="h-full rounded-[4px] bg-tint" style={{ width: `${Math.max(i.pct, 0.5)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
