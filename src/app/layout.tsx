import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kommune CRM – Tippgeber-Management',
  description: 'CRM für den kommunalen Strukturvertrieb. Tipps verwalten, Pipeline tracken, Tippgeber informieren.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
