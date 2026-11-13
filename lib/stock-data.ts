import type { Stock } from "./stock-types"

export const DEFAULT_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corp." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "BA", name: "The Boeing Company" },
  { symbol: "DIS", name: "The Walt Disney Company" },
  { symbol: "GE", name: "General Electric Company" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "NKE", name: "Nike Inc." },
  { symbol: "SBUX", name: "Starbucks Corp." },
]

// Generate sparkline values based on price and change
export function generateHistoryForPrice(price: number, change: number): number[] {
  const sparkline: number[] = []
  const prevClose = price - change
  let current = prevClose
  const step = change / 12
  
  for (let i = 0; i < 11; i++) {
    current += step + (Math.random() - 0.5) * (price * 0.01)
    sparkline.push(Number(current.toFixed(2)))
  }
  sparkline.push(Number(price.toFixed(2)))
  return sparkline
}

// Generate fallback stocks offline/error
export function generateInitialStocks(): Stock[] {
  return DEFAULT_STOCKS.map((stock) => {
    const basePrice = Math.random() * 300 + 40
    const change = (Math.random() - 0.5) * 12
    const prevClose = basePrice - change
    const changePercent = (change / prevClose) * 100
    const direction: "up" | "down" | "flat" = change > 0.01 ? "up" : change < -0.01 ? "down" : "flat"
    const sparkline = generateHistoryForPrice(basePrice, change)

    return {
      id: crypto.randomUUID(),
      symbol: stock.symbol,
      name: stock.name,
      price: basePrice,
      prevClose,
      change,
      changePercent,
      direction,
      sparkline,
      // Default fundamentals
      open: basePrice * 0.99,
      high: basePrice * 1.015,
      low: basePrice * 0.985,
      fiftyTwoWHigh: basePrice * 1.35,
      fiftyTwoWLow: basePrice * 0.75,
      volume: 25000000,
      avgVol: 28000000,
      pe: 25.4,
      mktCap: basePrice * 2.5 * 1000000000,
      beta: 1.1,
      eps: 4.5,
    }
  })
}

// Client fetch quotes from local API proxy
export async function fetchRealQuotes(symbols: string[]): Promise<Stock[] | null> {
  try {
    const res = await fetch(`/api/stocks?action=quotes&symbols=${encodeURIComponent(symbols.join(","))}`)
    if (!res.ok) throw new Error("API responded with error")
    
    const data = await res.json()
    if (!data.stocks || data.stocks.length === 0) return null

    return data.stocks.map((s: any) => {
      return {
        ...s,
        id: s.symbol, // use symbol as steady id for selection
        sparkline: s.sparkline && s.sparkline.length >= 2 ? s.sparkline : generateHistoryForPrice(s.price, s.change),
      }
    })
  } catch (error) {
    console.error("fetchRealQuotes failed:", error)
    return null
  }
}

// Client fetch chart from local API proxy
export async function fetchRealChart(symbol: string, timeframe: string): Promise<any[] | null> {
  try {
    const res = await fetch(`/api/stocks?action=chart&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`)
    if (!res.ok) throw new Error("API responded with error")
    
    const data = await res.json()
    return data.chart || null
  } catch (error) {
    console.error("fetchRealChart failed:", error)
    return null
  }
}

export function simulateStockUpdate(stock: Stock): Stock {
  const volatility = 0.012
  const changeAmount = stock.price * volatility * (Math.random() - 0.5)
  const newPrice = Math.max(0.01, stock.price + changeAmount)
  const newChange = newPrice - stock.prevClose
  const newChangePercent = (newChange / stock.prevClose) * 100
  const newDirection: "up" | "down" | "flat" = newChange > 0.01 ? "up" : newChange < -0.01 ? "down" : "flat"
  const newSparkline = [...stock.sparkline.slice(1), Number(newPrice.toFixed(2))]

  return {
    ...stock,
    price: newPrice,
    change: newChange,
    changePercent: newChangePercent,
    direction: newDirection,
    sparkline: newSparkline,
  }
}
