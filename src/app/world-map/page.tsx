import type { Metadata } from 'next'

import WorldMapClient from '@/app/world-map/WorldMapClient'

const siteName = "World's Top Artists"

export const metadata: Metadata = {
  title: `Global Listener Atlas | ${siteName}`,
  description:
    'Interactive world map showcasing Spotify listener hotspots for the top artists. Explore geographic reach, local fan bases, and emerging markets in a single view.',
  alternates: {
    canonical: '/world-map',
  },
  openGraph: {
    title: `Global Listener Atlas | ${siteName}`,
    description:
      'Discover where the world’s leading artists resonate most. Explore listener hubs, emerging cities, and global reach on an interactive map.',
    url: 'https://music.eduardlupu.com/world-map',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Global Listener Atlas | ${siteName}`,
    description:
      'Explore worldwide listener hotspots for Spotify’s top artists. Dive into regional reach and audience concentration.',
  },
}

export const dynamic = 'force-static'

export default function WorldMapPage() {
  return <WorldMapClient />
}
