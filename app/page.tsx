import type { Metadata } from "next"
import { MarketsView } from "@/components/markets-view"

// The home page is what gets shared, so its title leads with the app name
export const metadata: Metadata = { title: { absolute: "MarketBoard · Live markets for 16 countries" } }

export default function MarketsPage() {
  return <MarketsView />
}
