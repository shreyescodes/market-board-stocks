"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Briefcase, Globe, List, ListPlus, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Toaster } from "sonner"
import { DesktopToolbar, MobileHeader } from "./header"
import { FeedProvider, WorkspaceProvider, useFeed, useWorkspace } from "./workspace"
import { WatchlistsSheet } from "./watchlists-sheet"
import { Glass, useRefraction } from "./liquid-glass"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Markets", icon: Globe, match: (p: string) => p === "/" },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: Briefcase,
    match: (p: string) => p.startsWith("/portfolio"),
  },
  {
    href: "/watchlists",
    label: "Watchlists",
    icon: List,
    match: (p: string) => p.startsWith("/watchlists"),
  },
]
const spring = {
  type: "spring",
  stiffness: 420,
  damping: 36,
  mass: 0.8,
} as const
const COLLAPSED_KEY = "marketboard.sidebarCollapsed"
const WIDTH_OPEN = 248
const WIDTH_RAIL = 68

export function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  // Follow the system appearance on first load, like a native Apple app
  useEffect(() => {
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.style.colorScheme = theme
  }, [theme])
  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), [])

  return (
    <FeedProvider>
      <WorkspaceProvider>
        <div className={theme === "dark" ? "dark" : ""}>
          <Toaster position="top-center" theme={theme} offset={80} toastOptions={{ className: "liquid-toast" }} />
          <div className="min-h-screen bg-background pb-28 text-foreground md:pb-6">
            <ShellChrome theme={theme} onToggleTheme={toggleTheme}>
              {children}
            </ShellChrome>
            <TabBar />
          </div>
        </div>
      </WorkspaceProvider>
    </FeedProvider>
  )
}

function ShellChrome({
  theme,
  onToggleTheme,
  children,
}: {
  theme: "dark" | "light"
  onToggleTheme: () => void
  children: ReactNode
}) {
  const { feed } = useFeed()
  const [collapsed, setCollapsed] = useState(false)
  const [narrow, setNarrow] = useState(false)

  // Remember the user's choice; medium-width screens always use the icon rail
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1")
    } catch {}
    const mq = window.matchMedia("(max-width: 1023px)")
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1")
      } catch {}
      return !c
    })
  }, [])

  // ⌃⌘S toggles the sidebar, as in macOS apps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.metaKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])

  return (
    <>
      <MobileHeader theme={theme} feed={feed} onToggleTheme={onToggleTheme} />
      <div className="mx-auto flex max-w-[1680px] gap-5 px-3 sm:px-5 md:gap-6 md:pl-3">
        <Sidebar collapsed={collapsed || narrow} canToggle={!narrow} onToggle={toggle} />
        <div className="min-w-0 flex-1">
          <DesktopToolbar theme={theme} feed={feed} onToggleTheme={onToggleTheme} />
          <main className="pt-4 md:pt-1">{children}</main>
        </div>
      </div>
    </>
  )
}

/* A full-height floating glass sidebar, like macOS Tahoe: identity and toggle at the top,
   then sections. Collapses to an icon rail. */
function Sidebar({ collapsed, canToggle, onToggle }: { collapsed: boolean; canToggle: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { workspace, activeWatchlist, setActiveWatchlist } = useWorkspace()
  const [managing, setManaging] = useState(false)
  const lists = workspace?.watchlists ?? []
  const onWatchlists = pathname.startsWith("/watchlists")

  const item =
    "press group relative flex h-10 items-center gap-3 rounded-[16px] text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-tint/60"

  return (
    <motion.aside
      aria-label="Sidebar"
      initial={false}
      animate={{ width: collapsed ? WIDTH_RAIL : WIDTH_OPEN }}
      transition={spring}
      className="sticky top-3 mt-3 hidden h-[calc(100vh-24px)] shrink-0 self-start md:block"
    >
      <Glass className="flex h-full flex-col overflow-hidden rounded-[24px] p-2">
        {/* Identity and toggle (the automatic rail on medium screens has neither) */}
        {(!collapsed || canToggle) && (
          <div className={cn("flex h-11 shrink-0 items-center", collapsed ? "justify-center" : "justify-between pl-3")}>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="brand"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="display whitespace-nowrap text-[17px] font-semibold"
                >
                  MarketBoard
                </motion.span>
              )}
            </AnimatePresence>
            {canToggle && (
              <button
                onClick={onToggle}
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
                title={`${collapsed ? "Show" : "Hide"} Sidebar (⌃⌘S)`}
                className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label-2 outline-none hover:bg-fill hover:text-foreground focus-visible:ring-2 focus-visible:ring-tint/60"
              >
                {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
              </button>
            )}
          </div>
        )}

        <nav aria-label="Sections" className={cn("flex min-h-0 flex-1 flex-col", (!collapsed || canToggle) && "mt-2")}>
          {(!collapsed || canToggle) && <SectionLabel collapsed={collapsed}>Browse</SectionLabel>}
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon, match }) => {
              // On /watchlists the specific list below carries the highlight (as a playlist does in
              // Music); the rail has no list rows, so there the section icon stays highlighted
              const listShown = !collapsed && lists.length > 0
              const active = match(pathname) && !(href === "/watchlists" && listShown)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? label : undefined}
                    title={collapsed ? label : undefined}
                    className={cn(
                      item,
                      collapsed ? "justify-center" : "px-3",
                      active ? "text-foreground" : "text-label-2 hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="nav-lens"
                        transition={spring}
                        className="absolute inset-0 rounded-[16px] bg-selection"
                      />
                    ) : (
                      <span className="absolute inset-0 rounded-[16px] transition-colors group-hover:bg-selection/50" />
                    )}
                    <Icon
                      className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-tint")}
                      strokeWidth={2}
                      aria-hidden
                    />
                    {!collapsed && <span className="relative truncate whitespace-nowrap">{label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Your watchlists, like playlists in Music or folders in Notes */}
          {!collapsed && lists.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 flex min-h-0 flex-col">
              <div className="flex items-center justify-between pr-1">
                <SectionLabel collapsed={false}>Watchlists</SectionLabel>
                <button
                  onClick={() => setManaging(true)}
                  aria-label="Manage watchlists"
                  title="New or manage watchlists"
                  className="press -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-label-2 outline-none hover:bg-fill hover:text-foreground focus-visible:ring-2 focus-visible:ring-tint/60"
                >
                  <ListPlus className="h-4 w-4" />
                </button>
              </div>
              <ul className="hide-scrollbar flex min-h-0 flex-col gap-0.5 overflow-y-auto">
                {lists.map((l) => {
                  const active = onWatchlists && l.id === activeWatchlist?.id
                  return (
                    <li key={l.id}>
                      <button
                        onClick={() => {
                          setActiveWatchlist(l.id)
                          if (!onWatchlists) router.push("/watchlists")
                        }}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "press flex h-9 w-full items-center gap-3 rounded-[14px] px-3 text-left text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-tint/60",
                          active ? "bg-selection text-foreground" : "text-label-2 hover:bg-selection/50 hover:text-foreground",
                        )}
                      >
                        <List className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{l.name}</span>
                        <span className="num shrink-0 text-[12px] text-label-2">{l.symbols.length}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          )}
        </nav>

        {!collapsed && (
          <p className="shrink-0 whitespace-normal px-3 pb-1 pt-3 text-[11px] leading-snug text-label-2">
            Market data from Yahoo Finance. Some exchanges are delayed.
          </p>
        )}
      </Glass>
      <WatchlistsSheet open={managing} onClose={() => setManaging(false)} />
    </motion.aside>
  )
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (collapsed) return <div className="mx-auto mb-2 mt-1 h-px w-6 bg-separator" aria-hidden />
  return <h2 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-label-2">{children}</h2>
}

/* Phone: a floating glass tab bar, like iOS */
function TabBar() {
  const pathname = usePathname()
  const barRef = useRef<HTMLDivElement>(null)
  const { filter, style } = useRefraction(barRef, { bezel: 18, strength: 30 })
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden"
    >
      {filter}
      <div
        ref={barRef}
        style={style}
        className="glass mx-auto flex h-[62px] max-w-[420px] items-center justify-around rounded-full px-2"
      >
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press relative flex h-[50px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-tint/60",
                active ? "text-tint" : "text-label-2",
              )}
            >
              {active && (
                <motion.span layoutId="tab-lens" transition={spring} className="glass-thumb absolute inset-0 rounded-full" />
              )}
              <Icon className="relative h-[20px] w-[20px]" strokeWidth={2} aria-hidden />
              <span className="relative">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
