import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Notes',
  description: 'Dashboard over the markdown vault',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
