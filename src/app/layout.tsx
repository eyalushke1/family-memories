import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Family Memories',
  description: 'A private Netflix-style streaming platform for family memories',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased">
        {children}
      </body>
    </html>
  )
}
