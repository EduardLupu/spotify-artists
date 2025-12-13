import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Footer from '@/components/ui/footer'
import PwaUpdater from '@/components/pwa-updater'
import { GoogleAnalytics } from '@next/third-parties/google'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = 'https://music.eduardlupu.com'
const siteName = "World's Top Artists"
const defaultDescription =
  "Track Spotify's Top 500 artists with live monthly listeners, ranking changes, and momentum scores updated every 24 hours."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "World's Top 500 Spotify Artists",
    template: '%s | World’s Top Artists',
  },
  description: defaultDescription,
  keywords: [
    'top 500 artists',
    'Spotify monthly listeners',
    'Spotify stats',
    'artist rankings',
    'global music charts',
    'streaming statistics',
    'music analytics',
    'artist momentum score',
    'top Spotify artists',
    'artist monthly listeners',
    'music data dashboard',
    'artist growth trends',
    'world top artists',
  ],
  applicationName: siteName,
  authors: [{ name: 'Eduard Lupu', url: 'https://eduardlupu.com' }],
  creator: 'Eduard Lupu',
  publisher: 'Eduard Lupu',
  manifest: '/manifest.json',
  openGraph: {
    title: "World's Top 500 Spotify Artists",
    description: defaultDescription,
    url: siteUrl,
    siteName,
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: `${siteUrl}/web-app-manifest-512x512.png`,
        width: 512,
        height: 512,
        alt: siteName,
      },
      {
        url: `${siteUrl}/web-app-manifest-192x192.png`,
        width: 192,
        height: 192,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "World's Top 500 Spotify Artists",
    description: defaultDescription,
    images: [`${siteUrl}/web-app-manifest-512x512.png`],
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large',
    'max-video-preview': -1,
  },
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: 'black-translucent',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
          {children}
        </div>
        <PwaUpdater />
        <Footer />
        <GoogleAnalytics gaId="G-2NVJ33DBX4" />
      </body>
    </html>
  )
}
