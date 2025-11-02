import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { SyncStatus } from "@/components/sync-status"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "Billing Solutions - Smart Billing for Small Businesses",
    template: "%s | Billing Solutions",
  },
  description:
    "Manage products, create GST invoices, track customers, and generate reports. Offline-first PWA for small businesses.",
  keywords: ["billing", "invoicing", "GST", "inventory", "small business", "PWA"],
  authors: [{ name: "Billing Solutions" }],
  creator: "Billing Solutions",
  publisher: "Billing Solutions",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Billing Solutions",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    title: "Billing Solutions - Smart Billing for Small Businesses",
    description: "Manage products, create GST invoices, track customers, and generate reports.",
    siteName: "Billing Solutions",
  },
  twitter: {
    card: "summary",
    title: "Billing Solutions - Smart Billing for Small Businesses",
    description: "Manage products, create GST invoices, track customers, and generate reports.",
  },
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="font-sans antialiased">
        {children}
        <div className="fixed bottom-3 right-3 rounded-md border bg-background/80 px-3 py-2 shadow">
          <SyncStatus />
        </div>
        <Toaster />
        <SonnerToaster />
        <Analytics />
      </body>
    </html>
  )
}
