/*
 * What the Markets page shows for each market in lib/markets.ts.
 *
 * Every Yahoo symbol here was checked against Yahoo Finance and returns a live quote.
 * Where Yahoo has no local instrument, the page derives one honestly instead of inventing it:
 *  - Commodities and crypto trade in USD (or EUR); they are converted to the local currency
 *    with the live FX rate, and the change includes the currency move.
 *  - Yahoo's movers screeners are US-only, so other markets rank their largest listings.
 *  - Markets without sector indexes on Yahoo get cap-weighted sector moves from those listings.
 */

export type Kind = "yield" | "fx" | "price"
export type Instrument = { symbol: string; name: string; sub?: string; kind?: Kind }

export type Sector =
  | "Financials"
  | "Technology"
  | "Health Care"
  | "Energy"
  | "Materials"
  | "Industrials"
  | "Consumer Disc."
  | "Consumer Staples"
  | "Communication"
  | "Utilities"
  | "Real Estate"

/* ── Commodities: global futures, quoted in USD, US cents (USX) or EUR ── */
export type Commodity = { symbol: string; name: string; unit: string; currency: "USD" | "USX" | "EUR" }

export const COMMODITIES = {
  wti: { symbol: "CL=F", name: "WTI Crude", unit: "barrel", currency: "USD" },
  brent: { symbol: "BZ=F", name: "Brent Crude", unit: "barrel", currency: "USD" },
  natgas: { symbol: "NG=F", name: "Natural Gas", unit: "MMBtu", currency: "USD" },
  ttf: { symbol: "TTF=F", name: "Dutch TTF Gas", unit: "MWh", currency: "EUR" },
  gold: { symbol: "GC=F", name: "Gold", unit: "troy oz", currency: "USD" },
  silver: { symbol: "SI=F", name: "Silver", unit: "troy oz", currency: "USD" },
  platinum: { symbol: "PL=F", name: "Platinum", unit: "troy oz", currency: "USD" },
  palladium: { symbol: "PA=F", name: "Palladium", unit: "troy oz", currency: "USD" },
  copper: { symbol: "HG=F", name: "Copper", unit: "lb", currency: "USD" },
  aluminum: { symbol: "ALI=F", name: "Aluminum", unit: "tonne", currency: "USD" },
  lumber: { symbol: "LBR=F", name: "Lumber", unit: "1,000 bd ft", currency: "USD" },
  coffee: { symbol: "KC=F", name: "Coffee", unit: "lb", currency: "USX" },
  sugar: { symbol: "SB=F", name: "Sugar", unit: "lb", currency: "USX" },
  soybeans: { symbol: "ZS=F", name: "Soybeans", unit: "bushel", currency: "USX" },
  corn: { symbol: "ZC=F", name: "Corn", unit: "bushel", currency: "USX" },
  wheat: { symbol: "ZW=F", name: "Wheat", unit: "bushel", currency: "USX" },
} satisfies Record<string, Commodity>

export type CommodityId = keyof typeof COMMODITIES

export const CRYPTO: Commodity[] = [
  { symbol: "BTC-USD", name: "Bitcoin", unit: "coin", currency: "USD" },
  { symbol: "ETH-USD", name: "Ethereum", unit: "coin", currency: "USD" },
]

/* ── Market profiles ── */
export type MarketProfile = {
  currency: string
  /** Government bond yields (Yahoo only carries US Treasuries) */
  rates?: Instrument[]
  /** Counter currencies for the FX card; pairs are built by fxPairs() */
  fx: string[]
  /** Extra FX rows shown first, e.g. the US Dollar Index */
  fxExtra?: Instrument[]
  commodities: CommodityId[]
  volatility?: Instrument
  /** Official sector indexes or sector ETFs; when absent, sectors are computed from largeCaps */
  sectors?: { note: string; items: { symbol: string; name: string }[] }
  /** Movers universe for markets without a Yahoo screener, with sectors for computed sector moves */
  largeCaps?: { suffix: string; list: [symbol: string, sector: Sector][] | string[] }
}

const tag = (sector: Sector, ...symbols: string[]) => symbols.map((s) => [s, sector] as [string, Sector])

export const PROFILES: Record<string, MarketProfile> = {
  us: {
    currency: "USD",
    rates: [
      { symbol: "^IRX", name: "13-Week Bill", kind: "yield" },
      { symbol: "^FVX", name: "5-Year Note", kind: "yield" },
      { symbol: "^TNX", name: "10-Year Note", kind: "yield" },
      { symbol: "^TYX", name: "30-Year Bond", kind: "yield" },
    ],
    fxExtra: [{ symbol: "DX-Y.NYB", name: "US Dollar Index", sub: "DXY" }],
    fx: ["EUR", "GBP", "JPY", "INR", "CNY"],
    commodities: ["wti", "brent", "natgas", "gold", "silver", "copper"],
    volatility: { symbol: "^VIX", name: "VIX", sub: "S&P 500 implied volatility" },
    sectors: {
      note: "Select Sector SPDR ETFs",
      items: [
        { symbol: "XLK", name: "Technology" },
        { symbol: "XLF", name: "Financials" },
        { symbol: "XLV", name: "Health Care" },
        { symbol: "XLY", name: "Consumer Discretionary" },
        { symbol: "XLC", name: "Communication Services" },
        { symbol: "XLI", name: "Industrials" },
        { symbol: "XLP", name: "Consumer Staples" },
        { symbol: "XLE", name: "Energy" },
        { symbol: "XLU", name: "Utilities" },
        { symbol: "XLRE", name: "Real Estate" },
        { symbol: "XLB", name: "Materials" },
      ],
    },
  },

  ca: {
    currency: "CAD",
    fx: ["USD", "EUR", "GBP", "JPY", "CNY"],
    commodities: ["wti", "natgas", "gold", "silver", "copper", "lumber"],
    sectors: {
      note: "iShares S&P/TSX Capped sector ETFs",
      items: [
        { symbol: "XFN.TO", name: "Financials" },
        { symbol: "XEG.TO", name: "Energy" },
        { symbol: "XMA.TO", name: "Materials" },
        { symbol: "XGD.TO", name: "Gold Miners" },
        { symbol: "XIT.TO", name: "Info Tech" },
        { symbol: "XUT.TO", name: "Utilities" },
        { symbol: "XST.TO", name: "Consumer Staples" },
        { symbol: "XRE.TO", name: "REITs" },
      ],
    },
    largeCaps: {
      suffix: ".TO",
      list: ["RY", "TD", "SHOP", "ENB", "BN", "CNQ", "CP", "CNR", "BMO", "BNS", "CM", "TRI", "CSU", "ATD", "SU", "MFC", "WCN", "ABX", "AEM", "NTR", "TRP", "SLF", "FNV", "BCE", "T", "L", "IFC", "WPM", "CVE", "QSR", "DOL", "FTS", "H", "NA"],
    },
  },

  br: {
    currency: "BRL",
    fx: ["USD", "EUR", "GBP", "JPY", "CNY"],
    commodities: ["brent", "soybeans", "coffee", "sugar", "corn", "gold"],
    sectors: {
      note: "B3 sector indexes",
      items: [
        { symbol: "IFNC.SA", name: "Financials" },
        { symbol: "IMAT.SA", name: "Basic Materials" },
        { symbol: "INDX.SA", name: "Industrials" },
        { symbol: "ICON.SA", name: "Consumer" },
        { symbol: "UTIL.SA", name: "Utilities" },
        { symbol: "^IEE", name: "Electric Power" },
        { symbol: "IMOB.SA", name: "Real Estate" },
      ],
    },
    largeCaps: {
      suffix: ".SA",
      list: ["PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "ABEV3", "B3SA3", "WEGE3", "ITSA4", "RENT3", "SUZB3", "PRIO3", "EQTL3", "RDOR3", "RADL3", "BPAC11", "SBSP3", "VIVT3", "GGBR4", "CSAN3", "EMBJ3", "LREN3", "MGLU3", "HAPV3", "CMIG4", "TIMS3", "KLBN11", "UGPA3"],
    },
  },

  uk: {
    currency: "GBP",
    fx: ["USD", "EUR", "JPY", "CHF", "CNY"],
    commodities: ["brent", "ttf", "gold", "silver", "copper", "wti"],
    largeCaps: {
      suffix: ".L",
      list: [
        ...tag("Health Care", "AZN", "GSK"),
        ...tag("Energy", "SHEL", "BP"),
        ...tag("Financials", "HSBA", "LSEG", "BARC", "LLOY", "NWG", "PRU", "STAN", "AV", "III", "LGEN"),
        ...tag("Consumer Staples", "ULVR", "BATS", "DGE", "TSCO", "HLN", "IMB"),
        ...tag("Materials", "RIO", "AAL", "GLEN", "ANTO"),
        ...tag("Industrials", "REL", "RR", "BA", "EXPN"),
        ...tag("Consumer Disc.", "CPG"),
        ...tag("Utilities", "NG", "SSE"),
        ...tag("Communication", "VOD", "BT-A"),
        ...tag("Real Estate", "SGRO", "LAND"),
      ],
    },
  },

  de: {
    currency: "EUR",
    fx: ["USD", "GBP", "JPY", "CHF", "CNY"],
    commodities: ["brent", "ttf", "gold", "copper", "aluminum", "silver"],
    largeCaps: {
      suffix: ".DE",
      list: [
        ...tag("Technology", "SAP", "IFX"),
        ...tag("Industrials", "SIE", "DHL", "AIR", "RHM", "MTX", "ENR"),
        ...tag("Financials", "ALV", "MUV2", "DB1", "DBK", "CBK", "HNR1"),
        ...tag("Communication", "DTE"),
        ...tag("Consumer Disc.", "MBG", "BMW", "ADS", "VOW3", "P911", "CON", "ZAL"),
        ...tag("Materials", "BAS", "HEI", "SY1"),
        ...tag("Health Care", "BAYN", "MRK", "SHL", "FRE", "QIA"),
        ...tag("Utilities", "RWE", "EOAN"),
        ...tag("Consumer Staples", "HEN3", "BEI"),
        ...tag("Real Estate", "VNA"),
      ],
    },
  },

  fr: {
    currency: "EUR",
    fx: ["USD", "GBP", "JPY", "CHF", "CNY"],
    commodities: ["brent", "ttf", "gold", "wheat", "copper", "silver"],
    largeCaps: {
      suffix: ".PA",
      list: [
        ...tag("Consumer Disc.", "MC", "RMS", "KER", "STLAP", "ML", "AC", "RNO"),
        ...tag("Consumer Staples", "OR", "RI", "BN"),
        ...tag("Energy", "TTE"),
        ...tag("Health Care", "SAN", "EL", "ERF"),
        ...tag("Industrials", "AIR", "SU", "SAF", "DG", "HO", "SGO", "LR", "EN"),
        ...tag("Materials", "AI"),
        ...tag("Financials", "BNP", "CS", "ACA", "GLE"),
        ...tag("Technology", "CAP", "DSY", "STMPA"),
        ...tag("Utilities", "ENGI", "VIE"),
        ...tag("Communication", "ORA", "PUB"),
      ],
    },
  },

  ch: {
    currency: "CHF",
    fx: ["USD", "EUR", "GBP", "JPY", "CNY"],
    commodities: ["gold", "silver", "platinum", "brent", "ttf", "copper"],
    largeCaps: {
      suffix: ".SW",
      list: [
        ...tag("Consumer Staples", "NESN", "LISN"),
        ...tag("Health Care", "NOVN", "ROP", "LONN", "ALC", "SOON", "STMN", "SDZ"),
        ...tag("Financials", "UBSG", "ZURN", "PGHN", "SREN", "SLHN", "BAER", "HBAN"),
        ...tag("Consumer Disc.", "CFR", "UHR"),
        ...tag("Industrials", "ABBN", "GEBN", "KNIN", "SGSN", "SCHP"),
        ...tag("Materials", "SIKA", "HOLN", "GIVN", "EMSN"),
        ...tag("Communication", "SCMN"),
        ...tag("Technology", "LOGN", "VACN"),
        ...tag("Real Estate", "PSPN"),
      ],
    },
  },

  sa: {
    currency: "SAR",
    fx: ["USD", "EUR", "GBP", "AED"],
    commodities: ["brent", "wti", "natgas", "gold", "aluminum", "copper"],
    largeCaps: {
      suffix: ".SR",
      list: [
        ...tag("Energy", "2222", "2380"),
        ...tag("Financials", "1120", "1180", "1150", "1010", "1060", "1050", "1140", "1080", "1111", "8210", "4280"),
        ...tag("Materials", "2010", "1211", "2020", "2350", "2310"),
        ...tag("Communication", "7010", "7020"),
        ...tag("Utilities", "2082", "5110"),
        ...tag("Consumer Staples", "2280", "2050", "4001"),
        ...tag("Health Care", "4013", "4002"),
        ...tag("Consumer Disc.", "4190"),
        ...tag("Technology", "7203"),
        ...tag("Real Estate", "4300"),
        ...tag("Industrials", "4030"),
      ],
    },
  },

  za: {
    currency: "ZAR",
    fx: ["USD", "EUR", "GBP", "CNY", "JPY"],
    commodities: ["gold", "platinum", "palladium", "brent", "copper", "silver"],
    largeCaps: {
      suffix: ".JO",
      list: [
        ...tag("Consumer Disc.", "NPN", "PRX", "CFR", "WHL"),
        ...tag("Financials", "FSR", "SBK", "CPI", "ABG", "NED", "DSY", "SLM", "OMU", "REM"),
        ...tag("Consumer Staples", "BTI", "SHP", "BID", "CLS"),
        ...tag("Materials", "AGL", "BHG", "GLN", "SOL", "GFI", "ANG", "IMP", "SSW", "MNP", "HAR", "KIO", "VAL"),
        ...tag("Communication", "MTN", "VOD"),
        ...tag("Industrials", "BVT"),
        ...tag("Energy", "EXX"),
        ...tag("Health Care", "APN"),
        ...tag("Real Estate", "GRT"),
      ],
    },
  },

  in: {
    currency: "INR",
    fx: ["USD", "EUR", "GBP", "JPY", "CNY"],
    commodities: ["gold", "silver", "brent", "wti", "natgas", "copper"],
    volatility: { symbol: "^INDIAVIX", name: "India VIX", sub: "Nifty 50 implied volatility" },
    sectors: {
      note: "NSE Nifty sectoral indexes",
      items: [
        { symbol: "^NSEBANK", name: "Bank" },
        { symbol: "NIFTY_FIN_SERVICE.NS", name: "Financial Services" },
        { symbol: "^CNXIT", name: "IT" },
        { symbol: "^CNXENERGY", name: "Energy" },
        { symbol: "^CNXAUTO", name: "Auto" },
        { symbol: "^CNXFMCG", name: "FMCG" },
        { symbol: "^CNXPHARMA", name: "Pharma" },
        { symbol: "^CNXMETAL", name: "Metal" },
        { symbol: "^CNXINFRA", name: "Infrastructure" },
        { symbol: "^CNXREALTY", name: "Realty" },
        { symbol: "^CNXPSUBANK", name: "PSU Bank" },
        { symbol: "^CNXMEDIA", name: "Media" },
      ],
    },
    largeCaps: {
      suffix: ".NS",
      list: ["RELIANCE", "HDFCBANK", "TCS", "BHARTIARTL", "ICICIBANK", "INFY", "SBIN", "HINDUNILVR", "ITC", "LT", "BAJFINANCE", "KOTAKBANK", "HCLTECH", "SUNPHARMA", "MARUTI", "M&M", "AXISBANK", "ULTRACEMCO", "NTPC", "TITAN", "ONGC", "POWERGRID", "ADANIENT", "WIPRO", "JSWSTEEL", "TATASTEEL", "COALINDIA", "ASIANPAINT", "BAJAJFINSV", "NESTLEIND", "HINDALCO", "DRREDDY", "CIPLA", "TECHM", "ETERNAL", "TRENT", "ADANIPORTS", "BEL", "EICHERMOT", "APOLLOHOSP"],
    },
  },

  cn: {
    currency: "CNY",
    fx: ["USD", "EUR", "GBP", "JPY", "HKD"],
    commodities: ["copper", "gold", "soybeans", "brent", "aluminum", "silver"],
    sectors: {
      note: "CSI sector indexes",
      items: [
        { symbol: "000934.SS", name: "Financials" },
        { symbol: "000935.SS", name: "Info Tech" },
        { symbol: "000930.SS", name: "Industrials" },
        { symbol: "000931.SS", name: "Consumer Disc." },
        { symbol: "000932.SS", name: "Consumer Staples" },
        { symbol: "000933.SS", name: "Health Care" },
        { symbol: "000929.SS", name: "Materials" },
        { symbol: "000928.SS", name: "Energy" },
        { symbol: "000937.SS", name: "Utilities" },
        { symbol: "000936.SS", name: "Telecom" },
      ],
    },
    largeCaps: {
      suffix: "",
      list: ["600519.SS", "601398.SS", "601288.SS", "601939.SS", "601988.SS", "600036.SS", "601318.SS", "600900.SS", "601857.SS", "600028.SS", "300750.SZ", "002594.SZ", "000858.SZ", "000333.SZ", "600276.SS", "601899.SS", "600030.SS", "000651.SZ", "601088.SS", "600887.SS", "002415.SZ", "300760.SZ", "601166.SS", "600309.SS", "601728.SS", "600941.SS", "601628.SS", "000001.SZ", "300059.SZ", "601138.SS", "688981.SS", "002475.SZ", "600050.SS", "601668.SS"],
    },
  },

  hk: {
    currency: "HKD",
    fx: ["USD", "CNY", "EUR", "GBP", "JPY"],
    commodities: ["gold", "brent", "copper", "silver", "wti", "natgas"],
    sectors: {
      note: "Hang Seng sub-indexes",
      items: [
        { symbol: "^HSNF", name: "Finance" },
        { symbol: "^HSNC", name: "Commerce & Industry" },
        { symbol: "^HSNP", name: "Properties" },
        { symbol: "^HSNU", name: "Utilities" },
      ],
    },
    largeCaps: {
      suffix: ".HK",
      list: ["0700", "9988", "0005", "1299", "0939", "1398", "3690", "0941", "1810", "0388", "2318", "0883", "1211", "9618", "9999", "0001", "0016", "0002", "0003", "0027", "2388", "0857", "0386", "2628", "3988", "1024", "9888", "2020", "0066", "0823", "1109", "0669", "2269", "9961", "0688", "0006"],
    },
  },

  jp: {
    currency: "JPY",
    fx: ["USD", "EUR", "GBP", "CNY", "AUD"],
    commodities: ["brent", "wti", "natgas", "gold", "copper", "platinum"],
    sectors: {
      note: "NEXT FUNDS TOPIX-17 sector ETFs",
      items: [
        { symbol: "1631.T", name: "Banks" },
        { symbol: "1632.T", name: "Financials ex Banks" },
        { symbol: "1625.T", name: "Electric & Precision" },
        { symbol: "1622.T", name: "Autos & Transport Eq." },
        { symbol: "1624.T", name: "Machinery" },
        { symbol: "1626.T", name: "IT & Services" },
        { symbol: "1629.T", name: "Commercial & Wholesale" },
        { symbol: "1630.T", name: "Retail" },
        { symbol: "1621.T", name: "Pharmaceutical" },
        { symbol: "1620.T", name: "Raw Materials & Chem." },
        { symbol: "1623.T", name: "Steel & Nonferrous" },
        { symbol: "1619.T", name: "Construction & Materials" },
        { symbol: "1617.T", name: "Foods" },
        { symbol: "1618.T", name: "Energy Resources" },
        { symbol: "1627.T", name: "Electric Power & Gas" },
        { symbol: "1628.T", name: "Transport & Logistics" },
        { symbol: "1633.T", name: "Real Estate" },
      ],
    },
    largeCaps: {
      suffix: ".T",
      list: ["7203", "6758", "8306", "6861", "9983", "6501", "9984", "8035", "9432", "8316", "4063", "6098", "8058", "8001", "9433", "7974", "4502", "6367", "8411", "7267", "6902", "8031", "4568", "6981", "7741", "6954", "6273", "8766", "6503", "7011", "9434", "4519", "6702", "8053", "6723", "5401", "8801", "2914", "6146", "6857"],
    },
  },

  kr: {
    currency: "KRW",
    fx: ["USD", "EUR", "JPY", "CNY", "GBP"],
    commodities: ["brent", "wti", "copper", "gold", "natgas", "aluminum"],
    largeCaps: {
      suffix: ".KS",
      list: [
        ...tag("Technology", "005930", "000660", "006400", "009150", "018260"),
        ...tag("Industrials", "373220", "028260", "003550", "034730", "012450", "329180", "009540", "042660", "011200", "034020"),
        ...tag("Health Care", "207940", "068270"),
        ...tag("Consumer Disc.", "005380", "000270", "012330", "066570"),
        ...tag("Materials", "005490", "051910", "010130"),
        ...tag("Communication", "035420", "035720", "017670", "030200"),
        ...tag("Financials", "105560", "055550", "086790", "032830", "000810", "316140"),
        ...tag("Utilities", "015760"),
        ...tag("Energy", "096770"),
        ...tag("Consumer Staples", "033780"),
      ],
    },
  },

  sg: {
    currency: "SGD",
    fx: ["USD", "EUR", "GBP", "JPY", "CNY"],
    commodities: ["brent", "wti", "gold", "natgas", "copper", "silver"],
    largeCaps: {
      suffix: ".SI",
      list: [
        ...tag("Financials", "D05", "O39", "U11", "S68"),
        ...tag("Communication", "Z74"),
        ...tag("Real Estate", "C38U", "A17U", "H78", "9CI", "M44U", "ME8U", "N2IU", "U14", "C09", "AJBU"),
        ...tag("Consumer Staples", "Y92", "F34", "D01"),
        ...tag("Industrials", "C6L", "BN4", "S63", "J36", "BS6", "S58", "5E2", "C07"),
        ...tag("Consumer Disc.", "G13"),
        ...tag("Technology", "V03"),
        ...tag("Utilities", "U96"),
      ],
    },
  },

  au: {
    currency: "AUD",
    fx: ["USD", "EUR", "GBP", "JPY", "CNY"],
    commodities: ["gold", "copper", "brent", "natgas", "wheat", "silver"],
    volatility: { symbol: "^AXVI", name: "ASX VIX", sub: "S&P/ASX 200 implied volatility" },
    sectors: {
      note: "S&P/ASX 200 sector indexes",
      items: [
        { symbol: "^AXFJ", name: "Financials" },
        { symbol: "^AXMJ", name: "Materials" },
        { symbol: "^AXHJ", name: "Health Care" },
        { symbol: "^AXDJ", name: "Consumer Disc." },
        { symbol: "^AXNJ", name: "Industrials" },
        { symbol: "^AXEJ", name: "Energy" },
        { symbol: "^AXPJ", name: "A-REITs" },
        { symbol: "^AXSJ", name: "Consumer Staples" },
        { symbol: "^AXIJ", name: "Info Tech" },
        { symbol: "^AXTJ", name: "Communication" },
        { symbol: "^AXUJ", name: "Utilities" },
      ],
    },
    largeCaps: {
      suffix: ".AX",
      list: ["BHP", "CBA", "CSL", "NAB", "WBC", "ANZ", "MQG", "WES", "WDS", "FMG", "GMG", "TLS", "RIO", "WOW", "TCL", "ALL", "REA", "STO", "QBE", "COL", "SUN", "NST", "XRO", "RMD", "WTC", "S32", "BXB", "ORG", "CPU", "IAG", "SCG", "MIN", "PLS", "EVN", "COH", "SHL", "QAN", "ASX", "TWE"],
    },
  },
}

export const profileFor = (marketId: string): MarketProfile => PROFILES[marketId] ?? PROFILES.us

/* ── Derived symbol lists ── */

// Currencies conventionally quoted as the base of a pair (EUR/USD, GBP/USD, AUD/USD)
const STRONG_BASE = ["EUR", "GBP", "AUD"]

/** FX rows for a market, written the way that market's desks quote them */
export function fxPairs(p: MarketProfile): Instrument[] {
  const local = p.currency
  const pairs = p.fx.map((f): Instrument => {
    // In the US, majors keep their usual direction (EUR/USD, USD/JPY)
    const base = local === "USD" ? (STRONG_BASE.includes(f) ? f : "USD") : STRONG_BASE.includes(local) ? local : f
    const quote = base === f ? local : f
    return { symbol: rateSymbol(base, quote), name: `${base}/${quote}`, kind: "fx" }
  })
  return [...(p.fxExtra ?? []), ...pairs]
}

/** Yahoo symbol for "1 unit of `from` in `to`" */
export const rateSymbol = (from: string, to: string) => `${from}${to}=X`

export type LargeCap = { symbol: string; sector: Sector | null }

export function largeCapsFor(p: MarketProfile): LargeCap[] {
  if (!p.largeCaps) return []
  const { suffix, list } = p.largeCaps
  return list.map((entry) =>
    typeof entry === "string" ? { symbol: entry + suffix, sector: null } : { symbol: entry[0] + suffix, sector: entry[1] },
  )
}
