"use client"

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type RefObject,
} from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"

type GlassProps = HTMLAttributes<HTMLDivElement> & { solid?: boolean }

/* Floating Liquid Glass surface — use only for the navigation/control layer */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass({ className, solid, ...props }, ref) {
  return <div ref={ref} className={cn("glass", solid && "glass-solid", className)} {...props} />
})

/* ───────────────────────────────────────────────────────────
   Edge refraction (Chromium only: backdrop-filter: url(#svg))
   Builds a displacement map for the element's rounded shape so the
   content behind the rim bends inward, like a real glass lens.
   ─────────────────────────────────────────────────────────── */
function supportsSvgBackdrop() {
  if (typeof navigator === "undefined") return false
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands
  return !!brands?.some((b) => /Chrom/i.test(b.brand))
}

function buildDisplacementMap(w: number, h: number, radius: number, bezel: number) {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const img = ctx.createImageData(w, h)
  const data = img.data
  const r = Math.min(radius, w / 2, h / 2)
  const cx = w / 2
  const cy = h / 2
  const hx = w / 2 - r
  const hy = h / 2 - r

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - cx
      const py = y + 0.5 - cy
      const qx = Math.abs(px) - hx
      const qy = Math.abs(py) - hy
      let dist: number
      let nx = 0
      let ny = 0
      if (qx > 0 && qy > 0) {
        const l = Math.hypot(qx, qy) || 1
        dist = r - l
        nx = (qx / l) * Math.sign(px)
        ny = (qy / l) * Math.sign(py)
      } else if (qx > qy) {
        dist = r - qx
        nx = Math.sign(px)
      } else {
        dist = r - qy
        ny = Math.sign(py)
      }
      const i = (y * w + x) * 4
      let dx = 128
      let dy = 128
      if (dist >= 0 && dist < bezel) {
        // Convex bezel: refraction is strongest right at the rim
        const s = 1 - dist / bezel
        const m = s * s * (3 - 2 * s) * s
        dx = 128 - nx * m * 127
        dy = 128 - ny * m * 127
      }
      data[i] = dx
      data[i + 1] = dy
      data[i + 2] = 128
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

type RefractionOptions = { radius?: number; bezel?: number; strength?: number; blur?: number; saturate?: number }

export function useRefraction<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { radius, bezel = 16, strength = 28, blur = 9, saturate = 1.8 }: RefractionOptions = {},
) {
  const id = `lg-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`
  const [state, setState] = useState<{ w: number; h: number; map: string } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !supportsSvgBackdrop()) return
    if (window.matchMedia("(prefers-reduced-transparency: reduce)").matches) return

    let frame = 0
    const build = () => {
      const w = Math.round(el.offsetWidth)
      const h = Math.round(el.offsetHeight)
      if (!w || !h) return
      const map = buildDisplacementMap(w, h, radius ?? h / 2, bezel)
      if (map) setState({ w, h, map })
    }
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(build)
    })
    ro.observe(el)
    build()
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [ref, radius, bezel])

  const filter = state ? (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute", pointerEvents: "none" }}>
      <filter
        id={id}
        x="0"
        y="0"
        width={state.w}
        height={state.h}
        filterUnits="userSpaceOnUse"
        primitiveUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceGraphic" stdDeviation={blur * 0.35} result="soft" />
        <feImage href={state.map} x="0" y="0" width={state.w} height={state.h} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="soft" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" result="bent" />
        <feGaussianBlur in="bent" stdDeviation={blur} result="frost" />
        <feColorMatrix in="frost" type="saturate" values={String(saturate)} />
      </filter>
    </svg>
  ) : null

  const style: CSSProperties | undefined = state
    ? { backdropFilter: `url(#${id})`, WebkitBackdropFilter: `url(#${id})` }
    : undefined

  return { filter, style }
}

/* ───────────────────────────────────────────────────────────
   NumericText: digits roll vertically when the value changes,
   like SwiftUI's .contentTransition(.numericText())
   ─────────────────────────────────────────────────────────── */
export function NumericText({
  value,
  format,
  className,
}: {
  value: number
  format: (n: number) => string
  className?: string
}) {
  const prev = useRef(value)
  const dir = value > prev.current ? 1 : value < prev.current ? -1 : 0
  useEffect(() => {
    prev.current = value
  }, [value])

  const text = format(value)
  const chars = text.split("")

  return (
    <span className={cn("num inline-flex items-baseline", className)} aria-label={text}>
      {chars.map((ch, i) => {
        // Key by position from the right so a new leading digit doesn't reshuffle everything
        const pos = chars.length - i
        return (
          <span key={pos} className="relative inline-block overflow-hidden" aria-hidden>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                className="inline-block"
                initial={{ y: dir >= 0 ? "70%" : "-70%", opacity: 0, filter: "blur(3px)" }}
                animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                exit={{ y: dir >= 0 ? "-70%" : "70%", opacity: 0, filter: "blur(3px)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.6 }}
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        )
      })}
    </span>
  )
}

/* Apple-style change capsule */
export function ChangePill({
  direction,
  children,
  className,
}: {
  direction: "up" | "down" | "flat"
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "num inline-flex items-center justify-end rounded-[7px] px-1.5 py-[3px] text-[12px] font-semibold leading-none text-white transition-colors duration-500",
        direction === "up" && "bg-up",
        direction === "down" && "bg-down",
        direction === "flat" && "bg-[#8e8e93]",
        className,
      )}
      style={{
        boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.35), inset 0 -0.5px 0 rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </span>
  )
}
