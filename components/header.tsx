"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Moon, Sun } from "lucide-react"
import { useRefraction } from "./liquid-glass"
import { cn } from "@/lib/utils"

export type FeedState = {
  status: "connecting" | "live" | "stale" | "offline"
  lastUpdate: number | null
}

interface HeaderProps {
  theme: "dark" | "light"
  feed: FeedState
  onToggleTheme: () => void
}

const FEED_COPY: Record<FeedState["status"], { label: string; dot: string }> = {
  connecting: { label: "Connecting…", dot: "bg-label-3" },
  live: { label: "Updated", dot: "bg-up" },
  stale: { label: "Reconnecting · last update", dot: "bg-warn" },
  offline: { label: "Offline", dot: "bg-down" },
}

export function Header({ theme, feed, onToggleTheme }: HeaderProps) {
  const [now, setNow] = useState<Date | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const { filter, style } = useRefraction(barRef)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      {/* Scroll edge effect: content softens as it slides under the toolbar */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[92px] bg-gradient-to-b from-background/85 via-background/40 to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
      />
      {filter}
      <div
        ref={barRef}
        style={style}
        className="glass mx-auto flex h-[52px] max-w-[1400px] items-center justify-between rounded-full pl-5 pr-1.5"
      >
        <div className="flex items-baseline gap-2.5">
          <span className="display text-[17px] font-semibold">MarketBoard</span>
          <span className="flex items-center gap-1.5 text-[13px] text-label-2">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", FEED_COPY[feed.status].dot)} aria-hidden />
            <span className="sr-only sm:not-sr-only" role="status" aria-live="polite">
              {FEED_COPY[feed.status].label}
            </span>
            {feed.lastUpdate && (feed.status === "live" || feed.status === "stale") && (
              <span className="num hidden sm:inline">
                {new Date(feed.lastUpdate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="num hidden text-[13px] text-label-2 sm:inline">
            {now?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            <span className="mx-1.5 text-label-3">·</span>
            <span className="text-foreground">
              {now?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </span>
          </span>

          <button
            onClick={onToggleTheme}
            className="press fill flex h-10 w-10 items-center justify-center overflow-hidden rounded-full hover:bg-fill-hover"
            aria-label={theme === "dark" ? "Switch to light appearance" : "Switch to dark appearance"}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className="flex"
              >
                {theme === "dark" ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </header>
  )
}
