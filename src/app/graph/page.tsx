import type { Metadata } from 'next'

import GraphClient from '@/app/graph/GraphClient'

const siteName = "World's Top Artists"
const siteUrl = 'https://music.eduardlupu.com'
const pageTitle = `Artist Relationship Graph | ${siteName}`
const pageDescription =
  'Interactive 3D network of Spotify’s Top 500 artists. Visualise proximity, explore related acts, and jump into each artist’s live stats.'

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: '/graph',
  },
  keywords: ['Spotify artist graph', 'artist relationship map', 'music network visualization'],
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: `${siteUrl}/graph`,
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
  url: `${siteUrl}/graph`,
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Artist Relationship Graph', item: `${siteUrl}/graph` },
    ],
  },
}

export default function ArtistGraphPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GraphClient />
    </>
  )
}
