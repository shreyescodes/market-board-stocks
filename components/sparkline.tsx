/* A small price line for one session, optionally against a dashed previous-close line */
export function Sparkline({
  points,
  baseline,
  width = 72,
  height = 24,
  className,
  area,
  label,
}: {
  points: number[]
  baseline?: number | null
  width?: number
  height?: number
  className?: string
  area?: boolean
  label?: string
}) {
  if (points.length < 2) return <span className={className} style={{ display: "inline-block", width, height }} aria-hidden />
  const pad = 2
  const vals = baseline != null ? [...points, baseline] : points
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const range = hi - lo || 1
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - lo) / range)
  const x = (i: number) => (i * width) / (points.length - 1)
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  const last = points[points.length - 1]
  const ref = baseline ?? points[0]
  const color = last > ref ? "var(--up)" : last < ref ? "var(--down)" : "var(--label-2)"
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {baseline != null && (
        <line x1="0" x2={width} y1={y(baseline)} y2={y(baseline)} stroke="var(--label-2)" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      )}
      {area && <path d={`${d} L${width} ${height} L0 ${height} Z`} fill={color} fillOpacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
