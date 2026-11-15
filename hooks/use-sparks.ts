"use client"

import { useState } from "react"
import { usePoll } from "./use-poll"
import { fetchSparks, type Spark } from "@/lib/stock-data"

/** Intraday shapes for small charts; refreshed every two minutes, merged so a failed refresh keeps the last ones */
export function useSparks(symbols: string[], enabled = true) {
  const [sparks, setSparks] = useState<Record<string, Spark>>({})
  const key = [...new Set(symbols)].sort().join(",")
  usePoll(
    async () => {
      if (!symbols.length) return true
      const result = await fetchSparks([...new Set(symbols)])
      if (!result) return false
      setSparks((prev) => ({ ...prev, ...result }))
      return true
    },
    120_000,
    `sparks:${key}`,
    enabled && symbols.length > 0,
  )
  return sparks
}
