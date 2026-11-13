"use client"

import { useId } from "react"

interface SparklineProps {
  data?: number[] | null
  direction: "up" | "down" | "flat"
  width?: number
  height?: number
  strokeWidth?: number
  baseline?: number
}

// Catmull-Rom → cubic Bézier for a smooth, Apple-like line
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return ""
  let d = `M ${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const t = 0.18
    const c1x = p1.x + (p2.x - p0.x) * t
    const c1y = p1.y + (p2.y - p0.y) * t
    const c2x = p2.x - (p3.x - p1.x) * t
    const c2y = p2.y - (p3.y - p1.y) * t
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

export function Sparkline({ data, direction, width = 80, height = 24, strokeWidth = 1.5 }: SparklineProps) {
  const gradientId = useId()

  if (!data || data.length < 2) {
    // No real intraday data: leave the space empty rather than drawing a guess
    return <div style={{ width, height }} aria-hidden />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min === 0 ? 1 : max - min
  const pad = 3
  const w = width - pad * 2
  const h = height - pad * 2

  const points = data.map((val, idx) => ({
    x: pad + (idx / (data.length - 1)) * w,
    y: pad + h - ((val - min) / range) * h,
  }))
  const line = smoothPath(points)
  const area = `${line} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`

  const color = direction === "up" ? "var(--up)" : direction === "down" ? "var(--down)" : "var(--muted-foreground)"

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="select-none overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} style={{ transition: "d 0.6s ease" }} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "d 0.6s ease, stroke 0.5s ease" }}
      />
    </svg>
  )
}
