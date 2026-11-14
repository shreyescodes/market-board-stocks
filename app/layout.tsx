import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { AppShell } from "@/components/app-shell"

export const metadata: Metadata = {
  title: { default: "MarketBoard", template: "%s · MarketBoard" },
  description: "Markets dashboard, portfolio tracker and watchlists with live Yahoo Finance data",
  applicationName: "MarketBoard",
  icons: {
    // ?v= busts browsers' favicon cache, which otherwise keeps showing the old template icon
    icon: [
      { url: "/favicon.ico?v=2", sizes: "32x32" },
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
      { url: "/icon-32.png?v=2", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png?v=2",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8e8ed" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
