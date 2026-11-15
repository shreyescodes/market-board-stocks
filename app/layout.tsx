import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { AppShell } from "@/components/app-shell"

const SITE_URL = "https://market-board-ecru.vercel.app"
const DESCRIPTION =
  "Pick any of 16 markets and see its indexes, currency, commodities in local money, sectors and movers. Plus a portfolio and watchlists. Free, no sign-up."

export const metadata: Metadata = {
  // Absolute URLs for the link-preview image (opengraph-image.png in this folder)
  metadataBase: new URL(SITE_URL),
  title: { default: "MarketBoard", template: "%s · MarketBoard" },
  description: DESCRIPTION,
  applicationName: "MarketBoard",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "MarketBoard",
    title: "MarketBoard · Live markets for 16 countries",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "MarketBoard · Live markets for 16 countries",
    description: DESCRIPTION,
  },
  icons: {
    // ?v= busts browsers' favicon cache, which otherwise keeps showing the old template icon
    icon: [
      { url: "/favicon.ico?v=3", sizes: "32x32" },
      { url: "/icon.svg?v=3", type: "image/svg+xml" },
      { url: "/icon-32.png?v=3", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png?v=3",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8e8ed" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  )
}
