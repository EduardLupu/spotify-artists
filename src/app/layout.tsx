import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Footer from '@/components/ui/footer'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = 'https://music.eduardlupu.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'World’s Top Artists',
    template: '%s | World’s Top Artists',
  },
  description:
    'Discover the world’s top 500 artists — real-time listeners, daily ranks, and momentum insights updated every 24 hours.',
  keywords: [
    'World’s Top Artists',
    'Spotify analytics',
    'top artists',
    'music rankings',
    'streaming momentum',
    'music data',
  ],
  authors: [{ name: 'Eduard Lupu', url: 'https://eduardlupu.com' }],
  creator: 'Eduard Lupu',
  publisher: 'Eduard Lupu',
  openGraph: {
    title: 'World’s Top Artists',
    description:
      'Discover the world’s top 500 artists — real-time listeners, daily ranks, and momentum insights updated every 24 hours.',
    url: siteUrl,
    siteName: 'World’s Top Artists',
    type: 'website',
  },
  alternates: {
    canonical: '/',
  }
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
        <Footer />
      </body>
    </html>
  )
}
