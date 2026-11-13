export type IndexMeta = {
  symbol: string
  name: string
  region: "Americas" | "Europe" | "Asia-Pacific"
  country: string
}

// Yahoo Finance index symbols (all verified to return live quotes)
export const INDEX_CATALOG: IndexMeta[] = [
  { symbol: "^DJI", name: "Dow Jones", region: "Americas", country: "United States" },
  { symbol: "^GSPC", name: "S&P 500", region: "Americas", country: "United States" },
  { symbol: "^IXIC", name: "Nasdaq", region: "Americas", country: "United States" },
  { symbol: "^NDX", name: "Nasdaq-100", region: "Americas", country: "United States" },
  { symbol: "^RUT", name: "Russell 2000", region: "Americas", country: "United States" },
  { symbol: "^NYA", name: "NYSE Composite", region: "Americas", country: "United States" },
  { symbol: "^VIX", name: "VIX", region: "Americas", country: "United States" },
  { symbol: "^GSPTSE", name: "S&P/TSX", region: "Americas", country: "Canada" },
  { symbol: "^BVSP", name: "Ibovespa", region: "Americas", country: "Brazil" },
  { symbol: "^FTSE", name: "FTSE 100", region: "Europe", country: "United Kingdom" },
  { symbol: "^GDAXI", name: "DAX", region: "Europe", country: "Germany" },
  { symbol: "^FCHI", name: "CAC 40", region: "Europe", country: "France" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", region: "Europe", country: "Eurozone" },
  { symbol: "^N225", name: "Nikkei 225", region: "Asia-Pacific", country: "Japan" },
  { symbol: "^HSI", name: "Hang Seng", region: "Asia-Pacific", country: "Hong Kong" },
  { symbol: "000001.SS", name: "SSE Composite", region: "Asia-Pacific", country: "China" },
  { symbol: "^BSESN", name: "Sensex", region: "Asia-Pacific", country: "India" },
  { symbol: "^NSEI", name: "Nifty 50", region: "Asia-Pacific", country: "India" },
  { symbol: "^AXJO", name: "S&P/ASX 200", region: "Asia-Pacific", country: "Australia" },
  { symbol: "^KS11", name: "KOSPI", region: "Asia-Pacific", country: "South Korea" },
]

export const DEFAULT_INDICES = ["^DJI", "^GSPC", "^IXIC"]
export const MAX_INDICES = 3

export const indexMeta = (symbol: string) => INDEX_CATALOG.find((i) => i.symbol === symbol)
