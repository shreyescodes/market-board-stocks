"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { loadWorkspace, newId, saveWorkspace, type Position, type Watchlist, type Workspace } from "@/lib/storage"
import type { QuotesResult } from "@/lib/stock-data"

/* ───────────────────────── Workspace: watchlists + portfolio ───────────────────────── */

type WorkspaceApi = {
  ready: boolean
  workspace: Workspace | null
  activeWatchlist: Watchlist | null
  setActiveWatchlist: (id: string) => void
  createWatchlist: (name: string) => string
  renameWatchlist: (id: string, name: string) => void
  deleteWatchlist: (id: string) => void
  addSymbol: (listId: string, symbol: string) => void
  removeSymbol: (listId: string, symbol: string) => number
  insertSymbol: (listId: string, symbol: string, index: number) => void
  savePosition: (p: Omit<Position, "id" | "addedAt"> & { id?: string }) => void
  removePosition: (id: string) => Position | null
  restorePosition: (p: Position) => void
  replaceWorkspace: (ws: Workspace) => void
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)

  useEffect(() => {
    setWorkspace(loadWorkspace())
    // Keep several open tabs in sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === "marketboard.workspace.v1") setWorkspace(loadWorkspace())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const update = useCallback((fn: (w: Workspace) => Workspace) => {
    setWorkspace((prev) => {
      if (!prev) return prev
      const next = fn(prev)
      saveWorkspace(next)
      return next
    })
  }, [])

  const mapList = (w: Workspace, id: string, fn: (l: Watchlist) => Watchlist): Workspace => ({
    ...w,
    watchlists: w.watchlists.map((l) => (l.id === id ? fn(l) : l)),
  })

  const api = useMemo<WorkspaceApi>(() => {
    const active = workspace?.watchlists.find((l) => l.id === workspace.activeWatchlistId) ?? workspace?.watchlists[0] ?? null
    return {
      ready: workspace !== null,
      workspace,
      activeWatchlist: active,
      setActiveWatchlist: (id) => update((w) => ({ ...w, activeWatchlistId: id })),
      createWatchlist: (name) => {
        const id = newId()
        update((w) => ({ ...w, watchlists: [...w.watchlists, { id, name: name.trim() || "Watchlist", symbols: [] }], activeWatchlistId: id }))
        return id
      },
      renameWatchlist: (id, name) => update((w) => mapList(w, id, (l) => ({ ...l, name: name.trim() || l.name }))),
      deleteWatchlist: (id) =>
        update((w) => {
          if (w.watchlists.length <= 1) return w
          const watchlists = w.watchlists.filter((l) => l.id !== id)
          return { ...w, watchlists, activeWatchlistId: w.activeWatchlistId === id ? watchlists[0].id : w.activeWatchlistId }
        }),
      addSymbol: (listId, symbol) =>
        update((w) => mapList(w, listId, (l) => (l.symbols.includes(symbol) ? l : { ...l, symbols: [...l.symbols, symbol] }))),
      removeSymbol: (listId, symbol) => {
        const index = workspace?.watchlists.find((l) => l.id === listId)?.symbols.indexOf(symbol) ?? -1
        update((w) => mapList(w, listId, (l) => ({ ...l, symbols: l.symbols.filter((s) => s !== symbol) })))
        return index
      },
      insertSymbol: (listId, symbol, index) =>
        update((w) =>
          mapList(w, listId, (l) => {
            if (l.symbols.includes(symbol)) return l
            const symbols = [...l.symbols]
            symbols.splice(Math.max(0, Math.min(index, symbols.length)), 0, symbol)
            return { ...l, symbols }
          }),
        ),
      savePosition: (p) =>
        update((w) => {
          if (p.id && w.positions.some((x) => x.id === p.id)) {
            return { ...w, positions: w.positions.map((x) => (x.id === p.id ? { ...x, symbol: p.symbol, shares: p.shares, cost: p.cost } : x)) }
          }
          return { ...w, positions: [...w.positions, { id: newId(), symbol: p.symbol, shares: p.shares, cost: p.cost, addedAt: Date.now() }] }
        }),
      removePosition: (id) => {
        const removed = workspace?.positions.find((p) => p.id === id) ?? null
        update((w) => ({ ...w, positions: w.positions.filter((p) => p.id !== id) }))
        return removed
      },
      restorePosition: (p) => update((w) => (w.positions.some((x) => x.id === p.id) ? w : { ...w, positions: [...w.positions, p] })),
      replaceWorkspace: (ws) => update(() => ws),
    }
  }, [workspace, update])

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider")
  return ctx
}

/* ───────────────────────── Feed health (shown in the toolbar) ───────────────────────── */

export type FeedState = { status: "connecting" | "live" | "stale" | "offline"; lastUpdate: number | null }

const FeedContext = createContext<{ feed: FeedState; report: (r: QuotesResult | null) => void } | null>(null)

export function FeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<FeedState>({ status: "connecting", lastUpdate: null })
  const prev = useRef(feed.status)

  const report = useCallback((r: QuotesResult | null) => {
    setFeed((f) =>
      !r
        ? { ...f, status: f.lastUpdate ? "stale" : "offline" }
        : { status: r.stale ? "stale" : "live", lastUpdate: Math.max(r.fetchedAt, f.lastUpdate ?? 0) },
    )
  }, [])

  // Tell the user once when the feed degrades, and once when it recovers
  useEffect(() => {
    const was = prev.current
    prev.current = feed.status
    if (feed.status === was) return
    if (feed.status === "offline") toast.error("Can't reach market data. Retrying automatically.", { id: "feed" })
    else if (feed.status === "stale") toast.warning("Market data is delayed. Showing the last update.", { id: "feed" })
    else if (feed.status === "live" && (was === "stale" || was === "offline")) toast.success("Market data restored", { id: "feed" })
  }, [feed.status])

  const value = useMemo(() => ({ feed, report }), [feed, report])
  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>
}

export function useFeed() {
  const ctx = useContext(FeedContext)
  if (!ctx) throw new Error("useFeed must be used inside FeedProvider")
  return ctx
}
