# MarketBoard

A live stock watchlist with an Apple-style Liquid Glass interface, built with Next.js. Quotes, charts, index levels and ticker search come from Yahoo Finance through a small server route, so no API key is needed.

<!--
Screenshots: add these files, then uncomment the image lines below.
  docs/screenshots/dark.png          full window, dark appearance
  docs/screenshots/light.png         full window, light appearance
  docs/screenshots/index-picker.png  the index sheet open (e.g. India Indexes)
  docs/screenshots/world-markets.png the World Markets sheet open
  docs/screenshots/mobile.png        phone width

![MarketBoard in dark mode](docs/screenshots/dark.png)
![MarketBoard in light mode](docs/screenshots/light.png)
-->

## Features

- **Watchlist sidebar.** Twelve default symbols with price and daily change. Search the list, add any ticker through Yahoo Finance autocomplete, or remove one with the × button that appears on hover (or the Delete key), with **Undo** in the notification. Your watchlist is saved in the browser.
- **Detail view.** A large price header, a 1D / 1W / 1M / 3M / 1Y / ALL range control, and a price chart with a time axis and volume bars. Moving the pointer across the chart shows the price, change and time at that point in the header, the way Apple's Stocks app does.
  - **1D:** shows the latest regular trading session, with a dotted line at the official previous close.
  - **Times:** all chart times are in the exchange's own time zone.
- **Freshness.** Under the price you'll see when the quote is from and the market session, for example "As of 3:12 PM EST · Market open". If the quote falls behind during trading you'll see how far ("6 min behind"). Pre-market and after-hours prices appear when Yahoo has them.
- **Fundamentals.** Open, high, low, previous close, volume, average volume, market cap, P/E, EPS, dividend yield and the 52-week range, all taken from the live quote.
- **World market hours.** The first tile shows whether a market is open, in pre-market, after hours, on a lunch break, closed or on holiday. It includes a countdown and a progress bar for the session. Tap it to see 16 markets worldwide with their local time and status, and pick one.
  - **Holidays and early closes** are built in: "Holiday · Thanksgiving Day · Pre-market Fri 4:00 AM", "Early close in 1h 30m".
  - **Countdowns skip holidays,** so on the Friday before Martin Luther King Jr. Day the US shows "Pre-market Tue 4:00 AM".
- **Indexes that follow the market.** The strip next to the tile shows up to three indexes for the market you picked: Dow Jones, S&P 500 and Nasdaq for the United States; Nifty 50 (NSE) and Sensex (BSE) for India; FTSE 100 for the UK; Nikkei 225 for Japan; and so on, 44 indexes in all. Tap **Add Index** to choose from that market's list, which shows the exchange each index belongs to, and **×** to remove one. Each market remembers its own choice in the browser.
- **Light and dark appearance.** Follows your system setting on load. The sun/moon button switches it.
- **Responsive layout.** On a phone the sidebar stacks above the chart and the index strip scrolls sideways.

<!--
| Choose indexes | World market hours |
| --- | --- |
| ![Add Index sheet](docs/screenshots/index-picker.png) | ![World Markets sheet](docs/screenshots/world-markets.png) |

<p align="center">
  <img src="docs/screenshots/mobile.png" alt="MarketBoard on a phone" width="320" />
</p>
-->

## Design

The interface follows Apple's Liquid Glass approach: content sits on a plain black or white background, and glass is used only for the floating layer of controls.

- **Glass surfaces.** The toolbar, the watchlist sidebar, sheets and toasts are translucent with background blur, a thin highlight along the top edge and a soft shadow.
- **Edge refraction.** In Chromium browsers (Chrome, Edge, Brave, Arc) the toolbar also bends the content scrolling beneath it at its rim. This uses an SVG displacement map applied with `backdrop-filter`. Safari and Firefox get the frosted blur without the bending.
- **System palette.** Colors are Apple's system values for labels, separators, fills, green, red and blue, with separate light and dark sets.
- **Motion.** Prices roll digit by digit when they change. The range control and the watchlist selection slide between items on spring animations.

## Where the data comes from

All market data comes from Yahoo Finance through [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2), called from the server route in `app/api/stocks/route.ts`. Some values are derived rather than fetched, and this table says which:

| Data | Source |
| --- | --- |
| Price, change, open, high, low, previous close | Live Yahoo quote |
| Volume, average volume, market cap, 52-week range | Live Yahoo quote |
| P/E, EPS, dividend yield, exchange, currency | Live Yahoo quote |
| Index levels (`^DJI`, `^NSEI`, `^BSESN`, `^N225`, …) | Live Yahoo quote for the real index |
| Chart history for every range | Live Yahoo chart data, regular-session bars only |
| Pre-market and after-hours prices | Live Yahoo quote |
| Ticker search | Live Yahoo search |
| Market open/closed status | **Computed** from each exchange's hours and holiday rules, then **checked live** against Yahoo's session state for the market's main index |

**The app never invents data.** If Yahoo can't be reached, the last real prices stay on screen unchanged and the toolbar says **Reconnecting** with the time of the last good update. If there is no data at all, prices show "—" and the toolbar says **Offline**. A chart with no data shows an empty state with a **Try Again** button.

**Refresh rates:**
- Quotes every 10 seconds and index levels every 12 seconds, each as a single batched request.
- The open 1D chart every minute.

The server caches results briefly, so several open tabs don't multiply the load on Yahoo. Refreshing slows down while the feed is failing and pauses while the tab is hidden.

Yahoo Finance has no official public API, so `yahoo-finance2` depends on unofficial endpoints. Heavy use can be rate-limited for a while.

## Getting started

You need Node.js 20.9 or later.

```bash
git clone https://github.com/shreyescodes/market-board-stocks.git
cd market-board-stocks
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |

## API route

The front end talks only to `GET /api/stocks`:

| Query | Returns |
| --- | --- |
| `?action=quotes&symbols=AAPL,^GSPC` | Quotes, fundamentals, session state and extended-hours prices. `stale: true` means Yahoo is unreachable and these are the last good values |
| `?action=chart&symbol=AAPL&timeframe=1M` | Price and volume history for `1D`, `1W`, `1M`, `3M`, `1Y` or `ALL`, with the exchange's time zone |
| `?action=search&query=netflix` | Up to five matching stocks or ETFs |

## Project structure

```
app/
  api/stocks/route.ts     Yahoo Finance proxy: quotes, chart history, search
  globals.css             Design tokens and the glass material
  layout.tsx, page.tsx
components/
  stock-ticker-page.tsx   Page shell, state, polling and theme
  header.tsx              Floating glass toolbar
  watchlist-table.tsx     Glass sidebar: search, add, select, remove
  stock-details.tsx       Price header, range control, chart, fundamentals
  market-bar.tsx          Market-status tile, index strip and both pickers
  liquid-glass.tsx        Glass surface, edge refraction, rolling numbers, change pill
  sheet.tsx               Glass sheet used by the pickers
hooks/
  use-poll.ts             Polling with back-off that pauses in hidden tabs
lib/
  indices.ts              Indexes for each market, with their exchange
  markets.ts              Exchange hours and the open/closed status logic
  holidays.ts             Holiday and early-close calendars computed from exchange rules
  stock-data.ts           Client fetch helpers (quotes, charts)
  format.ts               Price, money and time formatting per currency and time zone
  stock-types.ts
```

## Tech stack

- [Next.js 16](https://nextjs.org) with the App Router, React 19 and TypeScript
- [Tailwind CSS 4](https://tailwindcss.com)
- [Framer Motion](https://motion.dev) for animation
- [Recharts](https://recharts.org) for the chart
- [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) for market data
- [Sonner](https://sonner.emilkowal.ski) for notifications and [Lucide](https://lucide.dev) for icons

## Limitations

- **Two kinds of holiday coverage:**
  - **Rule-based calendars** cover 10 markets: the US, Canada, Brazil, the UK, Germany, France, Switzerland, South Africa, Australia and Japan.
  - **Live status only** for China, Hong Kong, India, South Korea, Singapore and Saudi Arabia. Their holidays come from lunar or religious calendars announced each year, so on the day these markets show **Closed Today** once Yahoo confirms there has been no trading, but countdowns before the holiday don't account for it.
- **Unpredictable closures:** rules can't foresee one-off closures such as state funerals or emergencies. The live check catches those on the day.
- **Clock changes:** countdowns that span a daylight-saving change can be off by an hour.
- Edge refraction works only in Chromium browsers.
- Your watchlist, market and index choices are saved only in this browser.
