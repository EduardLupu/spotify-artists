import type { Metadata } from 'next'

import FormerArtistsClient from '@/app/former/FormerArtistsClient'
import { getFormerPayload, mapFormerRows } from '@/lib/data'

const siteName = "World's Top Artists"
const siteUrl = 'https://music.eduardlupu.com'
const pageTitle = `Former Top Artists | ${siteName}`
const pageDescription =
  'Archive of artists who dropped out of Top 500. See their last appearance, days away from the chart, and current monthly listeners.'

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: '/former',
  },
  keywords: [
    'former top 500 artists',
    'Spotify monthly listeners',
    'artist chart history',
    'dropped from Spotify charts',
  ],
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: `${siteUrl}/former`,
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
  '@type': 'CollectionPage',
  name: 'Former Top 500 Spotify artists',
  description: pageDescription,
  url: `${siteUrl}/former`,
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Former Top Artists', item: `${siteUrl}/former` },
    ],
  },
}

export default async function FormerArtistsPage() {
  const payload = await getFormerPayload()
  const artists = mapFormerRows(payload)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FormerArtistsClient artists={artists} generatedAt={payload.date} />
    </>
  )
}
