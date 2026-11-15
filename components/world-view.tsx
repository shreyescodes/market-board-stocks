"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { useMarket } from "./market-context"
import { PageTitle } from "./markets-view"
import { Sparkline } from "./sparkline"
import { useNow } from "@/hooks/use-browser"
import { useSparks } from "@/hooks/use-sparks"
import { MARKETS, getMarketStatus, secondsUntilOpen } from "@/lib/markets"
import { indexMeta } from "@/lib/indices"
import { profileFor } from "@/lib/market-profiles"
import { formatPercent, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

const REGIONS = ["Americas", "Europe", "Middle East & Africa", "Asia-Pacific"] as const
const code = (id: string) => (id === "uk" ? "GB" : id.toUpperCase())

/* Every market at a glance: session, local time, main index and its day. Pick one to make it your lens. */
export function WorldView() {
  const { probes, liveFor, market: current, setMarket, ready } = useMarket()
  const now = useNow()
  const router = useRouter()
  const sparks = useSparks(
    MARKETS.map((m) => m.probe),
    ready,
  )

  const rows = useMemo(
    () =>
      now
        ? MARKETS.map((m) => ({
            m,
            q: probes[m.id],
            status: getMarketStatus(m, now, liveFor(m.id)),
            until: secondsUntilOpen(m, now),
          }))
        : [],
    [now, probes, liveFor],
  )

  const open = rows.filter((r) => r.status.state === "open")
  const next = rows.filter((r) => r.status.state !== "open" && r.until != null).sort((a, b) => a.until! - b.until!)[0]
  const quoted = rows.filter((r) => r.q)
  const up = quoted.filter((r) => r.q!.direction === "up").length
  const down = quoted.filter((r) => r.q!.direction === "down").length
  const biggest = [...quoted].sort((a, b) => Math.abs(b.q!.changePercent) - Math.abs(a.q!.changePercent))[0]

  const choose = (id: string) => {
    setMarket(id)
    router.push("/")
  }

  const tile = "flex min-w-0 flex-col gap-1 rounded-[20px] bg-surface p-4"
  const tileLabel = "text-[11px] font-bold uppercase tracking-[0.05em] text-label-2"

  return (
    <div className="flex flex-col gap-5 pb-4">
      <PageTitle title="World" subtitle="16 markets · main index, last session and live status · your local time below each market" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={tile}>
          <span className={tileLabel}>Open now</span>
          <span className="num display text-[26px] font-bold">
            {open.length} <span className="text-[16px] font-semibold text-label-2">of {MARKETS.length}</span>
          </span>
          <span className="truncate text-[12px] text-label-2">{open.length ? open.map((r) => r.m.name).join(", ") : "All closed"}</span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Next to open</span>
          <span className="display truncate text-[21px] font-bold">{next?.m.name ?? "—"}</span>
          <span className="num truncate text-[12px] text-label-2">{next ? `${next.status.detail} · ${next.m.exchange}` : ""}</span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Last session</span>
          <span className="num display text-[26px] font-bold">
            <span className="text-up">{up}</span> <span className="text-[15px] font-semibold text-label-2">up</span> · <span className="text-down">{down}</span>{" "}
            <span className="text-[15px] font-semibold text-label-2">down</span>
          </span>
          <span className="text-[12px] text-label-2">Main index of each market</span>
        </div>
        <div className={tile}>
          <span className={tileLabel}>Biggest move</span>
          <span className="display truncate text-[21px] font-bold">
            {biggest ? (
              <>
                {biggest.m.name} <span className={biggest.q!.direction === "down" ? "text-down" : "text-up"}>{formatPercent(biggest.q!.changePercent)}</span>
              </>
            ) : (
              "—"
            )}
          </span>
          <span className="truncate text-[12px] text-label-2">{biggest ? (indexMeta(biggest.m.id, biggest.m.probe)?.name ?? biggest.m.probe) : ""}</span>
        </div>
      </div>

      <section aria-label="All markets" className="overflow-x-auto rounded-[22px] bg-surface px-3 pb-3 pt-1">
        <table className="w-full min-w-[860px] border-collapse text-[14px]">
          <thead>
            <tr className="text-[12px] text-label-2">
              <th scope="col" className="px-2.5 pb-2 pt-3 text-left font-semibold">Market</th>
              <th scope="col" className="px-2.5 pb-2 pt-3 text-left font-semibold">Session</th>
              <th scope="col" className="px-2.5 pb-2 pt-3 text-right font-semibold">Local time</th>
              <th scope="col" className="px-2.5 pb-2 pt-3 text-left font-semibold">Index</th>
              <th scope="col" className="px-2.5 pb-2 pt-3 text-right font-semibold">Last</th>
              <th scope="col" className="px-2.5 pb-2 pt-3 text-right font-semibold">Change</th>
              <th scope="col" className="w-[120px] px-2.5 pb-2 pt-3 text-right font-semibold">Last session</th>
              <th scope="col" className="w-8">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          {REGIONS.map((region) => (
            <tbody key={region}>
              <tr>
                <th scope="rowgroup" colSpan={8} className="px-2.5 pb-1.5 pt-5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-label-2">
                  {region}
                </th>
              </tr>
              {rows
                .filter((r) => r.m.region === region)
                .map(({ m, q, status }) => {
                  const isCurrent = m.id === current.id
                  const spark = sparks[m.probe]
                  const on = ["open", "pre", "post", "lunch"].includes(status.state)
                  return (
                    <tr
                      key={m.id}
                      onClick={() => choose(m.id)}
                      className={cn("cursor-pointer border-t border-separator transition-colors hover:bg-selection/60", isCurrent && "bg-selection")}
                    >
                      <td className="px-2.5 py-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            choose(m.id)
                          }}
                          className="flex items-center gap-2.5 rounded-[8px] text-left outline-none focus-visible:ring-2 focus-visible:ring-tint/60"
                          aria-label={`Make ${m.name} your market`}
                        >
                          <span
                            className={cn("w-7 shrink-0 rounded-[5px] py-px text-center text-[10px] font-bold", isCurrent ? "bg-tint-fill text-white" : "bg-fill text-label-2")}
                            aria-hidden
                          >
                            {code(m.id)}
                          </span>
                          <span className="flex flex-col">
                            <span className="font-semibold">{m.name}</span>
                            <span className="text-[12px] text-label-2">{isCurrent ? `${m.exchange} · your market` : m.exchange}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <span className="flex flex-col">
                          <span className="text-[13px] font-semibold" style={{ color: on ? status.color : "var(--label-2)" }}>
                            {status.label}
                          </span>
                          <span className="num text-[12px] text-label-2">{status.detail}</span>
                        </span>
                      </td>
                      <td className="num px-2.5 py-2.5 text-right text-label-2">{status.localTime}</td>
                      <td className="px-2.5 py-2.5 text-label-2">{indexMeta(m.id, m.probe)?.name ?? m.probe}</td>
                      <td className="num px-2.5 py-2.5 text-right font-medium">{q ? formatPrice(q.price, profileFor(m.id).currency) : "…"}</td>
                      <td className={cn("num px-2.5 py-2.5 text-right font-semibold", q?.direction === "up" ? "text-up" : q?.direction === "down" ? "text-down" : "text-label-2")}>
                        {q ? formatPercent(q.changePercent) : ""}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <Sparkline points={spark?.points ?? []} baseline={spark?.previousClose ?? q?.prevClose} width={96} height={26} />
                      </td>
                      <td className="pr-2 text-label-2">
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          ))}
        </table>
      </section>
      <p className="px-1 text-[12px] text-label-2">Pick a market to make it your lens; Today and Portfolio switch to it. Next-open times include each exchange&apos;s holidays.</p>
    </div>
  )
}
