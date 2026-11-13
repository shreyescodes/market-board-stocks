"use client"

import type React from "react"

import { useMemo } from "react"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Stock } from "@/lib/stock-types"

interface OverviewPanelsProps {
  stocks: Stock[]
}

export function OverviewPanels({ stocks }: OverviewPanelsProps) {
  const topGainers = useMemo(() => {
    return [...stocks]
      .filter((s) => s.direction === "up")
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 5)
  }, [stocks])

  const topLosers = useMemo(() => {
    return [...stocks]
      .filter((s) => s.direction === "down")
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 5)
  }, [stocks])

  const mostActive = useMemo(() => {
    return [...stocks].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5)
  }, [stocks])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <OverviewCard
        title="Top Gainers"
        icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
        stocks={topGainers}
        emptyMessage="No gainers yet"
        accentColor="emerald"
      />
      <OverviewCard
        title="Top Losers"
        icon={<TrendingDown className="h-4 w-4 text-red-500" />}
        stocks={topLosers}
        emptyMessage="No losers yet"
        accentColor="red"
      />
      <OverviewCard
        title="Most Active"
        icon={<Activity className="h-4 w-4 text-blue-500" />}
        stocks={mostActive}
        emptyMessage="No activity yet"
        accentColor="blue"
      />
    </div>
  )
}

function OverviewCard({
  title,
  icon,
  stocks,
  emptyMessage,
  accentColor,
}: {
  title: string
  icon: React.ReactNode
  stocks: Stock[]
  emptyMessage: string
  accentColor: "emerald" | "red" | "blue"
}) {
  const gradientClass = {
    emerald: "from-emerald-500 via-emerald-500/20 to-transparent",
    red: "from-red-500 via-red-500/20 to-transparent",
    blue: "from-blue-500 via-blue-500/20 to-transparent",
  }[accentColor]

  const rowHighlightClass = {
    emerald: "hover:bg-emerald-500/15",
    red: "hover:bg-red-500/15",
    blue: "hover:bg-blue-500/15",
  }[accentColor]

  return (
    <div className="relative rounded-lg p-[1px] bg-border transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md group">
      <div
        className={cn(
          "absolute inset-0 rounded-lg bg-gradient-to-bl opacity-80 transition-all duration-500 ease-in-out",
          gradientClass,
        )}
        style={{
          maskImage: "linear-gradient(135deg, black 0%, transparent 50%)",
          WebkitMaskImage: "linear-gradient(135deg, black 0%, transparent 50%)",
        }}
      />
      <div
        className={cn(
          "absolute inset-0 rounded-lg bg-gradient-to-bl opacity-0 group-hover:opacity-80 transition-opacity duration-500 ease-in-out",
          gradientClass,
        )}
        style={{
          maskImage: "linear-gradient(135deg, black 0%, transparent 70%)",
          WebkitMaskImage: "linear-gradient(135deg, black 0%, transparent 70%)",
        }}
      />
      <div className="relative rounded-lg bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {stocks.length > 0 ? (
            <ul className="space-y-2">
              {stocks.map((stock) => (
                <li
                  key={stock.id}
                  className={cn(
                    "flex items-center justify-between py-1.5 px-2 rounded-md transition-colors",
                    rowHighlightClass,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">{stock.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground tabular-nums font-light">
                      ${stock.price.toFixed(2)}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-light tabular-nums min-w-[60px] text-right",
                        stock.direction === "up" && "text-emerald-500",
                        stock.direction === "down" && "text-red-500",
                        stock.direction === "flat" && "text-muted-foreground",
                      )}
                    >
                      {stock.changePercent >= 0 ? "+" : ""}
                      {stock.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
          )}
        </CardContent>
      </div>
    </div>
  )
}
