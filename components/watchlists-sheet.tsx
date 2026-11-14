"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Check, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Sheet } from "./sheet"
import { useWorkspace } from "./workspace"
import { cn } from "@/lib/utils"

/* Switch between, create, rename and delete watchlists */
export function WatchlistsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace, activeWatchlist, setActiveWatchlist, createWatchlist, renameWatchlist, deleteWatchlist } = useWorkspace()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  useEffect(() => {
    if (open) return
    setEditing(null)
    setConfirmDelete(null)
    setCreating(false)
    setNewName("")
  }, [open])

  const lists = workspace?.watchlists ?? []

  const create = (e: FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    createWatchlist(name)
    toast.success(`Created ${name}`)
    onClose()
  }

  const rename = (e: FormEvent, id: string) => {
    e.preventDefault()
    if (draft.trim()) renameWatchlist(id, draft)
    setEditing(null)
  }

  const field = "fill h-10 min-w-0 flex-1 rounded-[12px] px-3 text-[15px] outline-none focus:ring-2 focus:ring-tint/50"
  const iconBtn =
    "press flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 hover:bg-fill-hover hover:text-foreground"

  return (
    <Sheet open={open} onClose={onClose} title="Watchlists" subtitle={`${lists.length} list${lists.length === 1 ? "" : "s"} · saved in this browser`}>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3 pt-1">
        {lists.map((l) => {
          const active = l.id === activeWatchlist?.id
          if (editing === l.id) {
            return (
              <form key={l.id} onSubmit={(e) => rename(e, l.id)} className="flex items-center gap-2 px-2 py-1.5">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={40}
                  aria-label="Watchlist name"
                  className={field}
                />
                <button type="submit" className="press h-10 shrink-0 rounded-full bg-tint-fill px-4 text-[13px] font-semibold text-white">
                  Save
                </button>
              </form>
            )
          }
          return (
            <div key={l.id} className={cn("flex items-center gap-2 rounded-[20px] px-2 py-1", active && "bg-selection")}>
              <button
                onClick={() => {
                  setActiveWatchlist(l.id)
                  onClose()
                }}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] px-1.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-tint/60"
              >
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="flex items-center gap-1.5 truncate text-[15px] font-medium">
                    {l.name}
                    {active && <Check className="h-4 w-4 shrink-0 text-tint" strokeWidth={2.5} aria-label="Current" />}
                  </span>
                  <span className="text-[12px] text-label-2">
                    {l.symbols.length} symbol{l.symbols.length === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
              {confirmDelete === l.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => setConfirmDelete(null)} className="press fill h-8 rounded-full px-3 text-[13px] font-semibold">
                    Keep
                  </button>
                  <button
                    onClick={() => {
                      deleteWatchlist(l.id)
                      setConfirmDelete(null)
                      toast(`Deleted ${l.name}`)
                    }}
                    className="press h-8 rounded-full bg-down-fill px-3 text-[13px] font-semibold text-white"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => {
                      setEditing(l.id)
                      setDraft(l.name)
                    }}
                    className={iconBtn}
                    aria-label={`Rename ${l.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                  {lists.length > 1 && (
                    <button onClick={() => setConfirmDelete(l.id)} className={iconBtn} aria-label={`Delete ${l.name}`}>
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {creating ? (
          <form onSubmit={create} className="mt-1 flex items-center gap-2 px-2 py-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              placeholder="Name, e.g. Tech or India"
              aria-label="New watchlist name"
              className={field}
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="press h-10 shrink-0 rounded-full bg-tint-fill px-4 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              Create
            </button>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="mt-1 flex items-center gap-2 rounded-[20px] px-3.5 py-3 text-left text-[15px] font-medium text-tint outline-none hover:bg-selection/60 focus-visible:ring-2 focus-visible:ring-tint/60"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} /> New Watchlist
          </button>
        )}
      </div>
    </Sheet>
  )
}
