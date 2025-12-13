import type { Metadata } from 'next'
import HomeClient from './HomeClient'

const siteUrl = 'https://music.eduardlupu.com'
const siteName = "World's Top Artists"
const pageTitle = "World's Top 500 Spotify Artists | Monthly listeners & rankings"
const pageDescription =
  'Live dashboard of the Top 500 Spotify artists. Compare monthly listeners, rank changes, momentum scores, and breakout streaks updated every 24 hours.'

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: '/',
  },
  keywords: [
    'top 500 artists',
    'Spotify monthly listeners',
    'Spotify rankings',
    'artist statistics',
    'streaming momentum',
    'global music chart',
    'Spotify artist dashboard',
    'artist rank today',
  ],
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: siteUrl,
    siteName,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
  },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteName,
  url: siteUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${siteUrl}/?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: "Top 500 artists by monthly listeners",
  description: pageDescription,
  url: siteUrl,
  isPartOf: siteName,
  about: ['Spotify Monthly listeners', 'Spotify artist ranking', 'streaming statistics'],
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Top 500 Artists', item: siteUrl },
    ],
  },
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([websiteJsonLd, collectionJsonLd]) }}
      />
      <HomeClient />
    </>
  )
}
