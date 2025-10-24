import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Spotify Artists Dashboard',
  description: 'Real-time Spotify artists data and analytics',
  keywords: ['spotify', 'artists', 'music', 'analytics', 'dashboard'],
  authors: [{ name: 'Spotify Artists Dashboard' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
          {children}
        </div>
      </body>
    </html>
  )
}
