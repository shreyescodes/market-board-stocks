import type { Metadata } from "next"
import { SymbolView } from "@/components/symbol-view"

type Props = { params: Promise<{ symbol: string }> }

const clean = (raw: string) => decodeURIComponent(raw).trim().toUpperCase().slice(0, 24)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params
  return { title: clean(symbol) }
}

export default async function SymbolPage({ params }: Props) {
  const { symbol } = await params
  return <SymbolView symbol={clean(symbol)} />
}
