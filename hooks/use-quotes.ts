"use client"

import { useState } from "react"
import { usePoll } from "./use-poll"
import { useFeed } from "@/components/workspace"
import { fetchQuotes } from "@/lib/stock-data"
import type { Stock } from "@/lib/stock-types"

/**
 * Live quotes for a set of symbols: one batched request per interval, with back-off on failure.
 * Results are merged, so a failed refresh keeps the last real values instead of clearing them.
 * Reports feed health to the toolbar unless `report` is false.
 */
export function useQuotes(symbols: string[], intervalMs = 10_000, { report = true, enabled = true } = {}) {
  const [quotes, setQuotes] = useState<Record<string, Stock>>({})
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const { report: reportFeed } = useFeed()
  const key = [...new Set(symbols)].sort().join(",")

  usePoll(
    async () => {
      if (!symbols.length) {
        setState("ready")
        return true
      }
      const result = await fetchQuotes([...new Set(symbols)])
      if (report) reportFeed(result)
      if (!result) {
        setState((s) => (s === "ready" ? s : "error"))
        return false
      }
      setQuotes((prev) => {
        const next = { ...prev }
        for (const s of result.stocks) next[s.symbol] = s
        return next
      })
      setState("ready")
      return !result.stale
    },
    intervalMs,
    key,
    enabled,
  )

  return { quotes, state }
}
