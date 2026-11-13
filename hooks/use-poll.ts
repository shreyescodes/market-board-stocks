"use client"

import { useEffect, useRef } from "react"

/**
 * Runs `task` now and then every `intervalMs`.
 * - Backs off exponentially (up to 2 min) while `task` reports failure
 * - Pauses while the tab is hidden and refreshes as soon as it is visible again
 * - Restarts whenever `key` changes
 */
export function usePoll(task: () => Promise<boolean>, intervalMs: number, key: string, enabled = true) {
  const taskRef = useRef(task)
  taskRef.current = task

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    let running = false
    let failures = 0

    const schedule = () => {
      clearTimeout(timer)
      if (cancelled || document.visibilityState === "hidden") return
      const delay = failures ? Math.min(intervalMs * 2 ** failures, 120_000) : intervalMs
      timer = setTimeout(run, delay)
    }

    const run = async () => {
      if (cancelled || running) return
      running = true
      let ok = false
      try {
        ok = await taskRef.current()
      } catch {
        ok = false
      }
      running = false
      failures = ok ? 0 : Math.min(failures + 1, 6)
      schedule()
    }

    const onVisibility = () => {
      clearTimeout(timer)
      if (document.visibilityState === "visible") run()
    }

    document.addEventListener("visibilitychange", onVisibility)
    run()
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [intervalMs, key, enabled])
}
