"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Briefcase, Globe, List } from "lucide-react"
import { Toaster } from "sonner"
import { Header } from "./header"
import { FeedProvider, WorkspaceProvider, useFeed } from "./workspace"
import { Glass, useRefraction } from "./liquid-glass"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Markets", icon: Globe, match: (p: string) => p === "/" },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase, match: (p: string) => p.startsWith("/portfolio") },
  { href: "/watchlists", label: "Watchlists", icon: List, match: (p: string) => p.startsWith("/watchlists") },
]
const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const

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
            <ShellHeader theme={theme} onToggleTheme={toggleTheme} />
            <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-3 pt-4 sm:px-5 md:grid-cols-[76px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[212px_minmax(0,1fr)]">
              <NavSidebar />
              <main className="min-w-0">{children}</main>
            </div>
            <TabBar />
          </div>
        </div>
      </WorkspaceProvider>
    </FeedProvider>
  )
}

function ShellHeader({ theme, onToggleTheme }: { theme: "dark" | "light"; onToggleTheme: () => void }) {
  const { feed } = useFeed()
  return <Header theme={theme} feed={feed} onToggleTheme={onToggleTheme} />
}

/* Desktop: a floating glass sidebar (icons on medium screens, icons + labels on wide ones) */
function NavSidebar() {
  const pathname = usePathname()
  return (
    <nav aria-label="Sections" className="hidden md:sticky md:top-[84px] md:block md:h-[calc(100vh-100px)] md:self-start">
      <Glass className="flex h-full flex-col rounded-[28px] p-2.5">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={label}
                  className={cn(
                    "press group relative flex h-11 items-center justify-center gap-3 rounded-[18px] px-3 text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-tint/60 xl:justify-start",
                    active ? "text-foreground" : "text-label-2 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span layoutId="nav-lens" transition={spring} className="absolute inset-0 rounded-[18px] bg-selection" />
                  ) : (
                    <span className="absolute inset-0 rounded-[18px] transition-colors group-hover:bg-selection/50" />
                  )}
                  <Icon className={cn("relative h-[19px] w-[19px] shrink-0", active && "text-tint")} strokeWidth={2} aria-hidden />
                  <span className="relative hidden xl:inline">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
        <p className="mt-auto hidden px-3 pb-1 text-[11px] leading-snug text-label-2 xl:block">
          Market data from Yahoo Finance. Some exchanges are delayed.
        </p>
      </Glass>
    </nav>
  )
}

/* Phone: a floating glass tab bar, like iOS */
function TabBar() {
  const pathname = usePathname()
  const barRef = useRef<HTMLDivElement>(null)
  const { filter, style } = useRefraction(barRef, { bezel: 18, strength: 30 })
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
      {filter}
      <div ref={barRef} style={style} className="glass mx-auto flex h-[62px] max-w-[420px] items-center justify-around rounded-full px-2">
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
              {active && <motion.span layoutId="tab-lens" transition={spring} className="glass-thumb absolute inset-0 rounded-full" />}
              <Icon className="relative h-[20px] w-[20px]" strokeWidth={2} aria-hidden />
              <span className="relative">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
