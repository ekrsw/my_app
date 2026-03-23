import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "シフト管理システム",
  description: "従業員シフト管理システム",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body
        className={`antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
