"use client"

import { useId } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

/* iOS-style segmented control: a glass track with a sliding thumb */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
  className?: string
  size?: "sm" | "md"
}) {
  const id = useId()
  return (
    <div role="tablist" aria-label={label} className={cn("fill inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full p-[3px] hide-scrollbar", className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "press relative shrink-0 whitespace-nowrap rounded-full font-semibold outline-none focus-visible:ring-2 focus-visible:ring-tint/60",
              size === "sm" ? "px-3 py-2 text-[12px] md:py-1" : "px-3.5 py-2 text-[13px] md:py-1.5",
              on ? "text-foreground" : "text-label-2 hover:text-foreground",
            )}
          >
            {on && <motion.span layoutId={`seg-${id}`} className="glass-thumb absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
