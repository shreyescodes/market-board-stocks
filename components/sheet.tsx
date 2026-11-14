"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Search, X } from "lucide-react"

const spring = { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } as const

// Remember where the last press happened so a sheet can grow out of the control that opened it
let lastPress: { x: number; y: number; at: number } | null = null
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => (lastPress = { x: e.clientX, y: e.clientY, at: Date.now() }), true)
}

function originOffset() {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  let point: { x: number; y: number } | null = null
  if (lastPress && Date.now() - lastPress.at < 1000) point = lastPress
  else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
    const r = document.activeElement.getBoundingClientRect()
    point = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  if (!point) return { x: 0, y: 24 }
  const centered = window.matchMedia("(min-width: 640px)").matches
  const targetY = centered ? window.innerHeight / 2 : window.innerHeight - 220
  return { x: point.x - window.innerWidth / 2, y: point.y - targetY }
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/* Glass sheet: slides up on phones, centered on larger screens, grows from its trigger */
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
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const origin = useRef({ x: 0, y: 24 })
  const wasOpen = useRef(false)
  // Callers often pass an inline onClose; keep the latest in a ref so re-renders (e.g. price
  // refreshes) don't re-run the open/close effect and steal focus from an open sheet
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Capture the trigger (for focus return) and the morph origin the moment the sheet opens
  if (open && !wasOpen.current && typeof window !== "undefined") {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    origin.current = originOffset()
  }
  wasOpen.current = open

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onCloseRef.current()
    window.addEventListener("keydown", onKey)
    // Focus the first field if there is one, otherwise the dialog itself
    const t = setTimeout(() => {
      const dialog = dialogRef.current
      if (!dialog || dialog.contains(document.activeElement)) return
      const field = dialog.querySelector<HTMLElement>("input")
      ;(field ?? dialog).focus()
    }, 30)
    return () => {
      window.removeEventListener("keydown", onKey)
      clearTimeout(t)
      const el = returnFocus.current
      if (el && document.contains(el)) el.focus({ preventScroll: true })
    }
  }, [open])

  // Keep Tab inside the sheet while it is open
  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !dialogRef.current) return
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!mounted) return null
  const from = { opacity: 0, scale: 0.35, x: origin.current.x, y: origin.current.y }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            onKeyDown={trapTab}
            initial={from}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ ...from, transition: { duration: 0.18, ease: "easeIn" } }}
            transition={spring}
            className="glass glass-solid relative flex max-h-[78vh] w-full max-w-[440px] flex-col rounded-[28px] text-foreground outline-none"
          >
            <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
              <div className="flex min-w-0 flex-col">
                <h3 className="display text-[20px] font-bold">{title}</h3>
                {subtitle && <span className="text-[13px] text-label-2">{subtitle}</span>}
              </div>
              <button
                onClick={onClose}
                className="press fill flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-2 outline-none hover:bg-fill-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-tint/60"
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
        <Search className="h-4 w-4 shrink-0 text-label-2" aria-hidden />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent pl-2 text-[15px] outline-none placeholder:text-label-2"
        />
      </div>
    </div>
  )
}
