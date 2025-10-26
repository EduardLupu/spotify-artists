import type { Metadata } from 'next'

import GraphClient from '@/app/graph/GraphClient'

const siteName = "World's Top Artists"

export const metadata: Metadata = {
  title: `Artist Relationship Graph | ${siteName}`,
  description:
    'Explore the Top 500 Spotify artists as an interactive 3D network. Inspect direct relationships, cluster focus, and jump into detailed dashboards.',
  alternates: {
    canonical: '/graph',
  },
  openGraph: {
    title: `Artist Relationship Graph | ${siteName}`,
    description:
      'Interactive 3D constellation of Spotify’s Top 500 artists. Visualise proximity and dive into connected profiles.',
    url: 'https://music.eduardlupu.com/graph',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Artist Relationship Graph | ${siteName}`,
    description:
      'Navigate the Spotify Top 500 artist network in an immersive 3D canvas and jump between related acts instantly.',
  },
}

export const dynamic = 'force-static'

export default function ArtistGraphPage() {
  return <GraphClient />
}
