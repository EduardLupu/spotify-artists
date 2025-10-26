import fs from 'fs'
import path from 'path'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import ArtistPage from '@/app/artist/ArtistClient'

const siteUrl = 'https://music.eduardlupu.com'
const baseTitle = 'World’s Top Artists'
const artistsDirectory = path.join(process.cwd(), 'public', 'data', 'artists')

type ArtistSummary = {
  i: string
  n: string
  p?: string
  bio?: string
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
    return {
      i: data?.i ?? id,
      n: data?.n ?? 'Unknown Artist',
      p: data?.p ?? undefined,
      bio: data?.bio ?? undefined,
    }
  } catch (error) {
    console.error(`Failed to read artist metadata for ${id}`, error)
    return null
  }
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

  const pageTitle = `${artist.n} | ${baseTitle}`
  const description =
    artist.bio?.slice(0, 252)?.concat('…') ??
    `Explore real-time Spotify performance metrics, listeners, and momentum insights for ${artist.n}.`
  const imageUrl = artist.p ? `https://i.scdn.co/image/${artist.p}` : `${siteUrl}/icon.svg`
  const pageUrl = `${siteUrl}/artist/${artist.i}`

  return {
    title: pageTitle,
    description,
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
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const artist = readArtistSummary(id)

  if (!artist) {
    notFound()
  }

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
      <ArtistPage artistId={artist.i} />
    </Suspense>
  )
}
