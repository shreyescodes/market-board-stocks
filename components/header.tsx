"use client"

import { useRef } from "react"
import { useNow } from "@/hooks/use-browser"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Moon, Search, Sun } from "lucide-react"
import { useRefraction } from "./liquid-glass"
import { useMarket } from "./market-context"
import { Flag } from "./flag"
import { formatAge } from "@/lib/format"
import { cn } from "@/lib/utils"

export type FeedState = {
  status: "connecting" | "live" | "stale" | "offline"
  lastUpdate: number | null
}

type ToolbarProps = {
  theme: "dark" | "light"
  feed: FeedState
  onToggleTheme: () => void
  onSearch: () => void
  onPickMarket: () => void
}

const DOT: Record<FeedState["status"], string> = {
  connecting: "bg-label-3",
  live: "bg-up",
  stale: "bg-warn",
  offline: "bg-down",
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

/** Calm feed status: "Updated 1 min ago", no ticking seconds */
function FeedStatus({ feed, compact }: { feed: FeedState; compact?: boolean }) {
  const now = useNow()
  const age = feed.lastUpdate && now ? formatAge(now.getTime() - feed.lastUpdate) : null
  const label =
    feed.status === "connecting"
      ? "Connecting…"
      : feed.status === "offline"
        ? "Offline"
        : feed.status === "stale"
          ? `Reconnecting${age ? ` · last update ${age}` : ""}`
          : `Updated ${age ?? "just now"}`
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-label-2">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[feed.status])} aria-hidden />
      <span className={compact ? "sr-only" : undefined} role="status" aria-live="polite">
        {label}
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

/** The market lens: shown on every page, opens the market picker */
function CountryButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  const { market } = useMarket()
  return (
    <button
      onClick={onClick}
      aria-label={`Market: ${market.name}. Change market`}
      className={cn(
        "press fill flex shrink-0 items-center gap-2 rounded-full font-semibold outline-none hover:bg-fill-hover focus-visible:ring-2 focus-visible:ring-tint/60",
        compact ? "h-10 px-3 text-[15px]" : "h-9 px-3.5 text-[14px]",
      )}
    >
      <Flag market={market.id} />
      <span className="max-w-[140px] truncate">{market.name}</span>
      <ChevronDown className="h-3.5 w-3.5 text-label-2" strokeWidth={2.5} aria-hidden />
    </button>
  )
}

/* Desktop: one glass toolbar over the content: market, search, feed status, appearance */
export function DesktopToolbar({ theme, feed, onToggleTheme, onSearch, onPickMarket }: ToolbarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { filter, style } = useRefraction(ref, { bezel: 14, strength: 24 })
  return (
    <div className="sticky top-0 z-40 hidden pb-2 pt-3 md:block">
      <ScrollEdge className="-inset-x-4" />
      {filter}
      <div ref={ref} style={style} className="glass flex h-[52px] items-center gap-2 rounded-full pl-2 pr-2">
        <CountryButton onClick={onPickMarket} />
        <button
          onClick={onSearch}
          className="press fill flex h-9 min-w-0 max-w-[460px] flex-1 items-center gap-2 rounded-full px-3.5 text-left text-[14px] text-label-2 outline-none hover:bg-fill-hover focus-visible:ring-2 focus-visible:ring-tint/60"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate">Search stocks, ETFs, indexes</span>
          <kbd className="rounded-[6px] border border-separator px-1.5 font-sans text-[11px] font-semibold">⌘K</kbd>
        </button>
        <div className="flex-1" />
        <FeedStatus feed={feed} />
        <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} size={36} />
      </div>
    </div>
  )
}

/* Phone: market chip, search and appearance in one compact glass bar */
export function MobileHeader({ theme, feed, onToggleTheme, onSearch, onPickMarket }: ToolbarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { filter, style } = useRefraction(ref)
  return (
    <header className="sticky top-0 z-50 px-3 pt-3 md:hidden">
      <ScrollEdge />
      {filter}
      <div ref={ref} style={style} className="glass flex h-[56px] items-center gap-2 rounded-full pl-2 pr-2">
        <CountryButton onClick={onPickMarket} compact />
        <FeedStatus feed={feed} compact />
        <div className="flex-1" />
        <button
          onClick={onSearch}
          aria-label="Search"
          className="press fill flex h-10 w-10 shrink-0 items-center justify-center rounded-full outline-none hover:bg-fill-hover focus-visible:ring-2 focus-visible:ring-tint/60"
        >
          <Search className="h-[18px] w-[18px]" aria-hidden />
        </button>
        <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} size={40} />
      </div>
    </header>
  )
}
