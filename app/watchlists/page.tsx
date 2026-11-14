import type { Metadata } from "next"
import { WatchlistsView } from "@/components/watchlists-view"

export const metadata: Metadata = { title: "Watchlists" }

export default function WatchlistsPage() {
  return <WatchlistsView />
}
