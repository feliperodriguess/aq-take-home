import type { Metadata } from "next"
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

import { cn } from "@/lib/utils"

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Iris — AI Interviewer",
  description: "Iris is your editorial AI interviewer — pick a role, step inside, and have a real conversation.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn("dark antialiased h-full", inter.variable, instrumentSerif.variable, jetbrainsMono.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
