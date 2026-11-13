"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Search, X } from "lucide-react"

const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const

/* Glass sheet: slides up from the bottom on phones, centered on larger screens */
export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={spring}
            className="glass glass-solid relative flex max-h-[78vh] w-full max-w-[440px] flex-col rounded-[28px] text-foreground"
          >
            <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
              <div className="flex min-w-0 flex-col">
                <h3 className="display text-[20px] font-bold">{title}</h3>
                {subtitle && <span className="text-[13px] text-label-2">{subtitle}</span>}
              </div>
              <button
                onClick={onClose}
                className="press fill flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-2 hover:bg-fill-hover hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function SheetSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="px-4 pb-2">
      <div className="fill flex h-9 items-center rounded-full pl-3 pr-2 focus-within:ring-2 focus-within:ring-tint/40">
        <Search className="h-4 w-4 shrink-0 text-label-2" />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent pl-2 text-[15px] outline-none placeholder:text-label-2"
        />
      </div>
    </div>
  )
}
