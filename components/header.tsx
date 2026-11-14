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

type ToolbarProps = {
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

/* Scroll edge effect: content softens as it slides under floating chrome */
function ScrollEdge({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[84px] bg-gradient-to-b from-background/85 via-background/40 to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]",
        className,
      )}
    />
  )
}

function FeedStatus({ feed, compact }: { feed: FeedState; compact?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-label-2">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", FEED_COPY[feed.status].dot)} aria-hidden />
      <span className={compact ? "sr-only" : undefined} role="status" aria-live="polite">
        {FEED_COPY[feed.status].label}
      </span>
      {!compact && feed.lastUpdate && (feed.status === "live" || feed.status === "stale") && (
        <span className="num">
          {new Date(feed.lastUpdate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </span>
  )
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="num whitespace-nowrap text-[13px] text-label-2">
      {now?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      <span className="mx-1.5 text-label-3">·</span>
      <span className="text-foreground">
        {now?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
      </span>
    </span>
  )
}

function ThemeToggle({ theme, onToggleTheme, size = 36 }: { theme: "dark" | "light"; onToggleTheme: () => void; size?: number }) {
  return (
    <button
      onClick={onToggleTheme}
      style={{ width: size, height: size }}
      className="press fill flex shrink-0 items-center justify-center overflow-hidden rounded-full outline-none hover:bg-fill-hover focus-visible:ring-2 focus-visible:ring-tint/60"
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
  )
}

/* Desktop: a small glass toolbar floating over the content area (the sidebar carries the app identity) */
export function DesktopToolbar({ theme, feed, onToggleTheme }: ToolbarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { filter, style } = useRefraction(ref, { bezel: 14, strength: 24 })
  return (
    <div className="sticky top-0 z-40 hidden justify-end pb-2 pt-3 md:flex">
      <ScrollEdge className="-inset-x-4" />
      {filter}
      <div ref={ref} style={style} className="glass flex h-11 items-center gap-3 rounded-full pl-4 pr-1">
        <FeedStatus feed={feed} />
        <span className="h-4 w-px bg-separator" aria-hidden />
        <Clock />
        <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} size={36} />
      </div>
    </div>
  )
}

/* Phone: a compact top bar with the app name, feed status and appearance toggle */
export function MobileHeader({ theme, feed, onToggleTheme }: ToolbarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { filter, style } = useRefraction(ref)
  return (
    <header className="sticky top-0 z-50 px-3 pt-3 md:hidden">
      <ScrollEdge />
      {filter}
      <div ref={ref} style={style} className="glass flex h-[52px] items-center justify-between rounded-full pl-5 pr-1.5">
        <div className="flex items-center gap-2.5">
          <span className="display text-[17px] font-semibold">MarketBoard</span>
          <FeedStatus feed={feed} compact />
        </div>
        <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} size={40} />
      </div>
    </header>
  )
}
