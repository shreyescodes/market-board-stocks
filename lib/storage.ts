/*
 * Browser-only persistence for the user's workspace (watchlists and portfolio).
 * Everything goes through this module so moving to server-side accounts later is one change.
 * Data can be exported to / imported from a JSON backup file.
 */
import { DEFAULT_SYMBOLS } from "./stock-data"

export type Watchlist = { id: string; name: string; symbols: string[] }
export type Position = {
  id: string
  symbol: string
  shares: number
  cost: number // average cost per share, in the instrument's quote currency units
  addedAt: number
}
export type Workspace = { watchlists: Watchlist[]; activeWatchlistId: string; positions: Position[] }

const KEY = "marketboard.workspace.v1"
const LEGACY_WATCHLIST_KEY = "marketboard.watchlist"

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function defaultWorkspace(): Workspace {
  const id = newId()
  return { watchlists: [{ id, name: "My Watchlist", symbols: [...DEFAULT_SYMBOLS] }], activeWatchlistId: id, positions: [] }
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)
const cleanSymbol = (s: unknown) => (typeof s === "string" ? s.trim().toUpperCase().slice(0, 24) : "")

/** Validate untrusted data (localStorage or an imported file) into a well-formed workspace */
export function sanitizeWorkspace(raw: unknown): Workspace | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const watchlists: Watchlist[] = Array.isArray(r.watchlists)
    ? r.watchlists
        .filter((w): w is Record<string, unknown> => !!w && typeof w === "object")
        .map((w) => ({
          id: typeof w.id === "string" && w.id ? w.id : newId(),
          name: typeof w.name === "string" && w.name.trim() ? w.name.trim().slice(0, 40) : "Watchlist",
          symbols: Array.isArray(w.symbols) ? [...new Set(w.symbols.map(cleanSymbol).filter(Boolean))] : [],
        }))
    : []
  const positions: Position[] = Array.isArray(r.positions)
    ? r.positions
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map((p) => ({
          id: typeof p.id === "string" && p.id ? p.id : newId(),
          symbol: cleanSymbol(p.symbol),
          shares: Number(p.shares),
          cost: Number(p.cost),
          addedAt: isNum(p.addedAt) ? p.addedAt : Date.now(),
        }))
        .filter((p) => p.symbol && isNum(p.shares) && p.shares > 0 && isNum(p.cost) && p.cost >= 0)
    : []
  if (!watchlists.length) return null
  const activeWatchlistId =
    typeof r.activeWatchlistId === "string" && watchlists.some((w) => w.id === r.activeWatchlistId)
      ? r.activeWatchlistId
      : watchlists[0].id
  return { watchlists, activeWatchlistId, positions }
}

export function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const ws = sanitizeWorkspace(JSON.parse(raw))
      if (ws) return ws
    }
    // Migrate the single watchlist saved by earlier versions
    const legacy = localStorage.getItem(LEGACY_WATCHLIST_KEY)
    const symbols = legacy ? JSON.parse(legacy) : null
    if (Array.isArray(symbols)) {
      const ws = defaultWorkspace()
      ws.watchlists[0].symbols = [...new Set(symbols.map(cleanSymbol).filter(Boolean))]
      return ws
    }
  } catch {}
  return defaultWorkspace()
}

export function saveWorkspace(ws: Workspace) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws))
  } catch {}
}

/* ── Backup files ── */
export type Backup = { app: "MarketBoard"; version: 1; exportedAt: string } & Workspace

export function toBackup(ws: Workspace): Backup {
  return { app: "MarketBoard", version: 1, exportedAt: new Date().toISOString(), ...ws }
}

export function fromBackup(text: string): Workspace {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("This file isn't valid JSON.")
  }
  if (!parsed || typeof parsed !== "object" || (parsed as Record<string, unknown>).app !== "MarketBoard") {
    throw new Error("This doesn't look like a MarketBoard backup.")
  }
  const ws = sanitizeWorkspace(parsed)
  if (!ws) throw new Error("The backup has no watchlists.")
  return ws
}
