import type { Metadata } from 'next'

import WorldMapClient from '@/app/world-map/WorldMapClient'

const siteName = "World's Top Artists"
const siteUrl = 'https://music.eduardlupu.com'
const pageTitle = `Global Listener Atlas | ${siteName}`
const pageDescription =
  'Interactive world map of Spotify listener hotspots for the Top 500 artists. Compare audience reach, top cities, and emerging markets in one view.'

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: '/world-map',
  },
  keywords: ['Spotify listener map', 'artist top cities', 'global fanbase', 'music audience geography'],
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: `${siteUrl}/world-map`,
    siteName,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
  },
}

export const dynamic = 'force-static'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: pageTitle,
  description: pageDescription,
  url: `${siteUrl}/world-map`,
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Global Listener Atlas', item: `${siteUrl}/world-map` },
    ],
  },
}

export default function WorldMapPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <WorldMapClient />
    </>
  )
}
