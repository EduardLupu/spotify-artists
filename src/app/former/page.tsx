import type { Metadata } from 'next'

import FormerArtistsClient from '@/app/former/FormerArtistsClient'
import { getFormerPayload, mapFormerRows } from '@/lib/data'

const siteName = "World's Top Artists"

export const metadata: Metadata = {
  title: `Former Top Artists | ${siteName}`,
  description:
    "Explore artists who once ranked in the global Top 500 on Spotify. See when they last appeared, how long they have been absent, and their current audience footprint.",
  alternates: {
    canonical: '/former',
  },
  openGraph: {
    title: `Former Top Artists | ${siteName}`,
    description:
      'Archive of former Top 500 Spotify artists. Track the recency of their last chart appearance and current audience metrics.',
    url: 'https://music.eduardlupu.com/former',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Former Top Artists | ${siteName}`,
    description:
      'See which artists slipped out of the Top 500, how long they have been away, and their current listener base.',
  },
}

export const dynamic = 'force-static'

export default async function FormerArtistsPage() {
  const payload = await getFormerPayload()
  const artists = mapFormerRows(payload)

  return <FormerArtistsClient artists={artists} generatedAt={payload.date} />
}
