"use client"

import { useMemo, useSyncExternalStore } from "react"

/*
 * Browser state read through useSyncExternalStore: the server render and hydration see the
 * server value, then React switches to the browser value without a setState-in-effect pass.
 */

const noopSubscribe = () => () => {}

/** False during the server render and hydration, true once running in the browser */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

/** Live result of a CSS media query; `serverValue` is used until hydration */
export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}

/* ── A clock shared by every component that shows the time (ticks once a second) ── */
let nowMs: number | null = null
const clockListeners = new Set<() => void>()
let clockTimer: ReturnType<typeof setInterval> | undefined

function subscribeClock(onTick: () => void) {
  clockListeners.add(onTick)
  if (!clockTimer) {
    const tick = () => {
      nowMs = Date.now()
      clockListeners.forEach((l) => l())
    }
    tick()
    clockTimer = setInterval(tick, 1000)
  }
  return () => {
    clockListeners.delete(onTick)
    if (!clockListeners.size) {
      clearInterval(clockTimer)
      clockTimer = undefined
    }
  }
}

/** The current time, updated every second; null during the server render and hydration */
export function useNow(): Date | null {
  const ms = useSyncExternalStore(
    subscribeClock,
    () => nowMs,
    () => null,
  )
  return useMemo(() => (ms == null ? null : new Date(ms)), [ms])
}

/* ── localStorage, shared across components and kept in sync across tabs ── */
const STORE_EVENT = "marketboard:storage"
// Fallback when storage is blocked (private mode, disabled site data): choices still work for this visit
const memory = new Map<string, string | null>()

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

export function writeStored(key: string, value: string | null) {
  memory.set(key, value)
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {}
  window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: key }))
}

function subscribeStorage(onChange: () => void) {
  // "storage" fires for writes in other tabs; STORE_EVENT for writes in this one
  window.addEventListener("storage", onChange)
  window.addEventListener(STORE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(STORE_EVENT, onChange)
  }
}

/** The raw stored string for `key`: undefined until hydration, null when nothing is saved */
export function useStoredString(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribeStorage,
    () => readStored(key),
    () => undefined,
  )
}
