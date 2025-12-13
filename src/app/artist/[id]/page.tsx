import fs from 'fs'
import path from 'path'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import ArtistPage from '@/app/artist/ArtistClient'

const siteUrl = 'https://music.eduardlupu.com'
const baseTitle = "World's Top Artists"
const artistsDirectory = path.join(process.cwd(), 'public', 'data', 'artists')

type ArtistSummary = {
  i: string
  n: string
  p?: string
  bio?: string
  today?: {
    ml?: number
    f?: number
    r?: number | null
    dr?: number | null
    g7?: number | null
    ms?: number | null
  }
  meta?: {
    br?: number | null
    days500?: number | null
  }
  topTrackNames?: string[]
}

function resolveArtistPath(id: string) {
  if (!id) return null
  const directory = path.join(artistsDirectory, id.slice(0, 2).toLowerCase())
  return path.join(directory, `${id}.json`)
}

function readArtistSummary(id: string): ArtistSummary | null {
  const filePath = resolveArtistPath(id)

  if (!filePath || !fs.existsSync(filePath)) {
    return null
  }

  try {
    const payload = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(payload)
    const topTrackNames = Array.isArray(data?.topTracks?.rows)
      ? data.topTracks.rows
          .slice(0, 5)
          .map((row: unknown[]) => (Array.isArray(row) && typeof row[1] === 'string' ? row[1] : null))
          .filter(Boolean)
      : []

    return {
      i: data?.i ?? id,
      n: data?.n ?? 'Unknown Artist',
      p: data?.p ?? undefined,
      bio: data?.bio ?? undefined,
      today: {
        ml: typeof data?.today?.ml === 'number' ? data.today.ml : undefined,
        f: typeof data?.today?.f === 'number' ? data.today.f : undefined,
        r: typeof data?.today?.r === 'number' ? data.today.r : null,
        dr: typeof data?.today?.dr === 'number' ? data.today.dr : null,
        g7: typeof data?.today?.g7 === 'number' ? data.today.g7 : null,
        ms: typeof data?.today?.ms === 'number' ? data.today.ms : null,
      },
      meta: {
        br: typeof data?.meta?.br === 'number' ? data.meta.br : null,
        days500: typeof data?.meta?.days500 === 'number' ? data.meta.days500 : null,
      },
      topTrackNames: topTrackNames.length ? (topTrackNames as string[]) : undefined,
    }
  } catch (error) {
    console.error(`Failed to read artist metadata for ${id}`, error)
    return null
  }
}

const buildDescription = (artist: ArtistSummary) => {
  const listenerCopy = artist.today?.ml ? `${artist.today.ml.toLocaleString()} monthly listeners` : 'live monthly listeners'
  const rankCopy = artist.today?.r ? `current global rank #${artist.today.r}` : 'current global rank updates'
  if (artist.bio && artist.bio !== '.') {
    return artist.bio.slice(0, 240)
  }
  return `See ${artist.n}'s ${listenerCopy}, ${rankCopy}, rank change, top tracks, and momentum updated daily.`
}

export function generateStaticParams() {
  const params: { id: string }[] = []

  if (!fs.existsSync(artistsDirectory)) {
    return params
  }

  for (const segment of fs.readdirSync(artistsDirectory)) {
    const segmentPath = path.join(artistsDirectory, segment)
    if (!fs.statSync(segmentPath).isDirectory()) continue

    for (const file of fs.readdirSync(segmentPath)) {
      if (!file.endsWith('.json')) continue
      params.push({ id: file.replace(/\.json$/, '') })
    }
  }

  return params
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const artist = readArtistSummary(id)

  if (!artist) {
    return {
      title: baseTitle,
      alternates: {
        canonical: '/',
      },
    }
  }

  const description = buildDescription(artist)
  const pageTitle = `${artist.n} | ${baseTitle}`
  const imageUrl = artist.p ? `https://i.scdn.co/image/${artist.p}` : `${siteUrl}/app-icon.svg`
  const pageUrl = `${siteUrl}/artist/${artist.i}`
  const keywords = [
    `${artist.n} Spotify`,
    `${artist.n} monthly listeners`,
    `${artist.n} statistics`,
    `${artist.n} rank`,
    `${artist.n} streaming stats`,
    `${artist.n} followers`,
  ]

  return {
    title: pageTitle,
    description,
    keywords,
    alternates: {
      canonical: `/artist/${artist.i}`,
    },
    openGraph: {
      title: pageTitle,
      description,
      type: 'profile',
      url: pageUrl,
      siteName: baseTitle,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${artist.n} cover art`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [imageUrl],
    },
    robots: { index: true, follow: true },
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const artist = readArtistSummary(id)

  if (!artist) {
    notFound()
  }

  const description = artist ? buildDescription(artist) : ''

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white/70">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            Loading artist data...
          </div>
        </div>
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'MusicGroup',
            name: artist?.n,
            url: `${siteUrl}/artist/${artist?.i}`,
            image: artist?.p ? `https://i.scdn.co/image/${artist.p}` : undefined,
            description,
            sameAs: [`https://open.spotify.com/artist/${artist?.i}`],
            additionalProperty: [
              typeof artist?.today?.ml === 'number' && {
                '@type': 'PropertyValue',
                name: 'Monthly listeners',
                value: artist.today.ml,
                unitCode: 'C62',
              },
              typeof artist?.today?.f === 'number' && {
                '@type': 'PropertyValue',
                name: 'Followers',
                value: artist.today.f,
              },
              typeof artist?.today?.r === 'number' && {
                '@type': 'PropertyValue',
                name: 'Current rank',
                value: artist.today.r,
              },
              typeof artist?.meta?.br === 'number' && {
                '@type': 'PropertyValue',
                name: 'Best rank',
                value: artist.meta.br,
              },
              typeof artist?.meta?.days500 === 'number' && {
                '@type': 'PropertyValue',
                name: 'Days in Top 500',
                value: artist.meta.days500,
              },
              typeof artist?.today?.g7 === 'number' && {
                '@type': 'PropertyValue',
                name: 'Listeners change 7d',
                value: artist.today.g7,
              },
              typeof artist?.today?.ms === 'number' && {
                '@type': 'PropertyValue',
                name: 'Momentum score',
                value: artist.today.ms,
              },
            ].filter(Boolean),
            track: artist?.topTrackNames?.map((trackName) => ({
              '@type': 'MusicRecording',
              name: trackName,
              byArtist: artist?.n,
            })),
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
                { '@type': 'ListItem', position: 2, name: 'Top Artists', item: `${siteUrl}/` },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: artist?.n,
                  item: `${siteUrl}/artist/${artist?.i}`,
                },
              ],
            },
          }),
        }}
      />
      <ArtistPage artistId={artist!.i} />
    </Suspense>
  )
}
