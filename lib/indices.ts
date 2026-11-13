export type IndexMeta = {
  symbol: string // Yahoo Finance symbol
  name: string
  source: string // exchange or index provider
  market: string // market id from lib/markets.ts
}

// Indexes grouped by the market they track. Every symbol was checked
// against Yahoo Finance and returns a live quote.
export const INDEX_CATALOG: IndexMeta[] = [
  // United States
  { market: "us", symbol: "^DJI", name: "Dow Jones", source: "NYSE · Nasdaq" },
  { market: "us", symbol: "^GSPC", name: "S&P 500", source: "NYSE · Nasdaq" },
  { market: "us", symbol: "^IXIC", name: "Nasdaq", source: "Nasdaq" },
  { market: "us", symbol: "^NDX", name: "Nasdaq-100", source: "Nasdaq" },
  { market: "us", symbol: "^NYA", name: "NYSE Composite", source: "NYSE" },
  { market: "us", symbol: "^RUT", name: "Russell 2000", source: "FTSE Russell" },
  { market: "us", symbol: "^VIX", name: "VIX", source: "Cboe" },
  // Canada
  { market: "ca", symbol: "^GSPTSE", name: "S&P/TSX Composite", source: "TSX" },
  // Brazil
  { market: "br", symbol: "^BVSP", name: "Ibovespa", source: "B3" },
  { market: "br", symbol: "^IBX50", name: "IBrX 50", source: "B3" },
  // United Kingdom
  { market: "uk", symbol: "^FTSE", name: "FTSE 100", source: "LSE" },
  { market: "uk", symbol: "^FTMC", name: "FTSE 250", source: "LSE" },
  // Germany
  { market: "de", symbol: "^GDAXI", name: "DAX", source: "Xetra" },
  { market: "de", symbol: "^MDAXI", name: "MDAX", source: "Xetra" },
  { market: "de", symbol: "^TECDAX", name: "TecDAX", source: "Xetra" },
  { market: "de", symbol: "^STOXX50E", name: "Euro Stoxx 50", source: "STOXX" },
  // France
  { market: "fr", symbol: "^FCHI", name: "CAC 40", source: "Euronext Paris" },
  { market: "fr", symbol: "^SBF120", name: "SBF 120", source: "Euronext Paris" },
  { market: "fr", symbol: "^STOXX50E", name: "Euro Stoxx 50", source: "STOXX" },
  // Switzerland
  { market: "ch", symbol: "^SSMI", name: "SMI", source: "SIX" },
  { market: "ch", symbol: "^SSHI", name: "SPI", source: "SIX" },
  // Saudi Arabia
  { market: "sa", symbol: "^TASI.SR", name: "TASI", source: "Tadawul" },
  // South Africa
  { market: "za", symbol: "^J203.JO", name: "All Share", source: "JSE" },
  { market: "za", symbol: "^J200.JO", name: "Top 40", source: "JSE" },
  // India
  { market: "in", symbol: "^NSEI", name: "Nifty 50", source: "NSE" },
  { market: "in", symbol: "^BSESN", name: "Sensex", source: "BSE" },
  { market: "in", symbol: "^NSEBANK", name: "Nifty Bank", source: "NSE" },
  { market: "in", symbol: "^CNXIT", name: "Nifty IT", source: "NSE" },
  { market: "in", symbol: "^NSMIDCP", name: "Nifty Next 50", source: "NSE" },
  { market: "in", symbol: "^NSEMDCP50", name: "Nifty Midcap 50", source: "NSE" },
  { market: "in", symbol: "BSE-100.BO", name: "BSE 100", source: "BSE" },
  // China
  { market: "cn", symbol: "000001.SS", name: "SSE Composite", source: "SSE" },
  { market: "cn", symbol: "399001.SZ", name: "SZSE Component", source: "SZSE" },
  { market: "cn", symbol: "000300.SS", name: "CSI 300", source: "SSE · SZSE" },
  // Hong Kong
  { market: "hk", symbol: "^HSI", name: "Hang Seng", source: "HKEX" },
  { market: "hk", symbol: "^HSCE", name: "Hang Seng China Ent.", source: "HKEX" },
  // Japan
  { market: "jp", symbol: "^N225", name: "Nikkei 225", source: "TSE" },
  // South Korea
  { market: "kr", symbol: "^KS11", name: "KOSPI", source: "KRX" },
  { market: "kr", symbol: "^KS200", name: "KOSPI 200", source: "KRX" },
  { market: "kr", symbol: "^KQ11", name: "KOSDAQ", source: "KRX" },
  // Singapore
  { market: "sg", symbol: "^STI", name: "Straits Times", source: "SGX" },
  // Australia
  { market: "au", symbol: "^AXJO", name: "S&P/ASX 200", source: "ASX" },
  { market: "au", symbol: "^AORD", name: "All Ordinaries", source: "ASX" },
  { market: "au", symbol: "^AXKO", name: "S&P/ASX 300", source: "ASX" },
]

export const MAX_INDICES = 3

export const indexesFor = (marketId: string) => INDEX_CATALOG.filter((i) => i.market === marketId)

export const indexMeta = (marketId: string, symbol: string) =>
  INDEX_CATALOG.find((i) => i.market === marketId && i.symbol === symbol)

// The first three indexes listed for a market are its defaults
export const defaultIndexesFor = (marketId: string) =>
  indexesFor(marketId)
    .slice(0, MAX_INDICES)
    .map((i) => i.symbol)
