import type {Metadata} from 'next'
import {Inter} from 'next/font/google'
import './globals.css'
import Footer from '@/components/ui/footer'
import PwaUpdater from '@/components/pwa-updater'
import {GoogleAnalytics} from "@next/third-parties/google";

const inter = Inter({subsets: ['latin']})

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
        'music analytics',
        'artists ranking',
        'real-time listeners',
        'music charts',
        'top artists',
        'music rankings',
        'streaming momentum',
        'best artists',
        'music data',
        'monthly listeners',
        'artist insights',
        'music trends',
        ''
    ],
    authors: [{name: 'Eduard Lupu', url: 'https://eduardlupu.com'}],
    creator: 'Eduard Lupu',
    publisher: 'Eduard Lupu',
    manifest: '/manifest.json',
    openGraph: {
        title: 'World’s Top Artists',
        description: 'Discover the world’s top 500 artists — real-time listeners, daily ranks, and momentum insights updated every 24 hours.',
        url: siteUrl,
        siteName: 'World’s Top Artists',
        type: 'website',
        locale: 'en_US',
        images: [
            {
                url: `${siteUrl}/web-app-manifest-512x512.png`,
                width: 512,
                height: 512,
                alt: 'World’s Top Artists',
            },
            {
                url: `${siteUrl}/web-app-manifest-192x192.png`,
                width: 192,
                height: 192,
                alt: 'World’s Top Artists',
            }
        ],
    },
    alternates: {
        canonical: '/',
    },
    appleWebApp: {
        capable: true,
        title: 'World’s Top Artists',
        statusBarStyle: 'black-translucent',
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
        <PwaUpdater />
        <Footer/>
        <GoogleAnalytics gaId="G-2NVJ33DBX4"/>
        </body>
        </html>
    )
}
