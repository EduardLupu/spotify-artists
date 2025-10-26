'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  ChevronDown,
  Disc3,
  Globe2,
  History,
  Loader2,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'

interface Artist {
  i: string
  n: string
  p: string
  r: number
  ml: number
  f: number
  dr: number | null
  g1: number
  g7: number
  g30: number
  fs: number
  ms: number
  br: number | null
  st: number
}

interface Top500Data {
  v: number
  date: string
  fields: string[]
  rows: any[][]
}

type ViewKey = 'rank' | 'momentum' | 'growth' | 'fresh' | 'followers' | 'delta'

const viewConfig: Record<ViewKey, { label: string; description: string }> = {
  rank: { label: 'Global 500', description: 'Ordered by current global rank.' },
  momentum: { label: 'Momentum', description: 'Artists with the strongest momentum score.' },
  growth: { label: 'Growth', description: 'Largest listener growth in the past 7 days.' },
  fresh: { label: 'New Heat', description: 'Freshness score highlights breakout acts.' },
  followers: { label: 'Followers', description: 'Artists sorted by total Spotify followers.' },
  delta: { label: 'Rank Delta', description: 'Artists with the biggest rank changes today.' },
}

const formatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  if (value === 0) return '0'
  if (value < 1000) return `${value}`
  return formatter.format(value)
}

function formatDelta(value: number | null) {
  if (value === null || value === undefined) return '–'
  if (value === 0) return '±0'
  return `${value > 0 ? '+' : ''}${value}`
}

function ArtistCard({ artist }: { artist: Artist }) {
  const rankMovement = artist.dr ?? 0
  const showDelta = Number.isFinite(rankMovement)

  return (
    <Link href={`/artist/${artist.i}`} className="group">
      <Card className="relative h-full overflow-hidden border-transparent bg-white/5 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/10">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/10 blur-3xl transition-opacity group-hover:opacity-60" />
        <CardHeader className="flex flex-row items-start gap-4 pb-2">
          <div className="relative">
            <Avatar className="h-14 w-14 ring-1 ring-white/10 ring-offset-2 ring-offset-black/40">
              <AvatarImage
                src={`https://i.scdn.co/image/${artist.p}`}
                alt={artist.n}
                className="object-cover"
                onError={(event) => {
                  event.currentTarget.src = '/placeholder-artist.svg'
                }}
              />
              <AvatarFallback>{artist.n.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <Badge
              variant="outline"
              className="absolute -bottom-3 -right-2 rounded-full border-white/20 bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur"
            >
              #{artist.r}
            </Badge>
          </div>
          <div className="flex-1 space-y-2">
            <CardTitle className="text-lg font-semibold leading-6 text-white group-hover:text-white/90">
              {artist.n}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
              <Users className="h-3 w-3" />
              {formatNumber(artist.ml)} monthly listeners
            </CardDescription>
          </div>
          {showDelta && (
            <Badge
              variant={rankMovement <= 0 ? 'secondary' : 'muted'}
              className={`self-start text-xs font-semibold ${
                rankMovement > 0 ? 'text-emerald-300' : rankMovement < 0 ? 'text-rose-300' : 'text-white/70'
              }`}
            >
              {formatDelta(-rankMovement)} Δ
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm text-white/80">
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 transition-colors group-hover:border-white/10">
              <p className="text-[11px] uppercase tracking-wide text-white/40">Followers</p>
              <p className="mt-1 text-base font-semibold text-white">{formatNumber(artist.f)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 transition-colors group-hover:border-white/10">
              <p className="text-[11px] uppercase tracking-wide text-white/40">Momentum</p>
              <p className="mt-1 text-base font-semibold text-white">
                {artist.ms ? artist.ms.toFixed(1) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 transition-colors group-hover:border-white/10">
              <p className="text-[11px] uppercase tracking-wide text-white/40">7 day</p>
              <p
                className={`mt-1 text-base font-semibold ${
                  artist.g7 >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {artist.g7 >= 0 ? '+' : ''}
                {formatNumber(artist.g7)}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 transition-colors group-hover:border-white/10">
              <p className="text-[11px] uppercase tracking-wide text-white/40">Best rank</p>
              <p className="mt-1 text-base font-semibold text-white">{artist.br ? `#${artist.br}` : '—'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>{artist.st} day streak</span>
            <span className="inline-flex items-center gap-1 text-emerald-200/70">
              Detail
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function Home() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [view, setView] = useState<ViewKey>('rank')
  const [visibleCount, setVisibleCount] = useState(24)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const response = await fetch('/data/latest/top500.json')
        if (!response.ok) {
          throw new Error('Failed to load dataset')
        }
        const data: Top500Data = await response.json()

        const artistData: Artist[] = data.rows.map((row) => ({
          i: row[0],
          n: row[1],
          p: row[2],
          r: row[3],
          ml: row[4],
          f: row[5],
          dr: row[6],
          g1: row[7],
          g7: row[8],
          g30: row[9],
          fs: row[10],
          ms: row[11],
          br: row[12],
          st: row[13],
        }))

        setArtists(artistData)
        setLastUpdated(data.date)
      } catch (error) {
        console.error('Error fetching artists:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtists()
  }, [])

  const filteredArtists = useMemo(() => {
    if (!searchTerm) return artists
    return artists.filter((artist) => artist.n.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [artists, searchTerm])

  const orderedArtists = useMemo(() => {
    const base = [...filteredArtists]
    switch (view) {
      case 'delta':
        return base.sort((a, b) => (b.dr ?? 0) - (a.dr ?? 0))
      case 'momentum':
        return base.sort((a, b) => b.ms - a.ms)
      case 'growth':
        return base.sort((a, b) => b.g7 - a.g7)
      case 'fresh':
        return base.sort((a, b) => b.fs - a.fs)
      case 'followers':
        return base.sort((a, b) => b.f - a.f)
      case 'rank':
      default:
        return base.sort((a, b) => a.r - b.r)
    }
  }, [filteredArtists, view])

  const spotlight = useMemo(() => orderedArtists[0], [orderedArtists])

  const metrics = useMemo(() => {
    if (!artists.length) {
      return {
        totalMonthlyListeners: 0,
        avgMomentum: 0,
        topGrowth: null as Artist | null,
        freshCount: 0,
      }
    }

    const totalMonthlyListeners = artists.reduce((acc, artist) => acc + (artist.ml || 0), 0)
    const avgMomentum = artists.reduce((acc, artist) => acc + (artist.ms || 0), 0) / artists.length
    const topGrowth = [...artists].sort((a, b) => b.g7 - a.g7)[0] ?? null
    const freshCount = artists.filter((artist) => artist.fs >= 70).length

    return { totalMonthlyListeners, avgMomentum, topGrowth, freshCount }
  }, [artists])

  const totalArtists = orderedArtists.length
  const remaining = Math.max(totalArtists - visibleCount, 0)
  const nextBatchSize = Math.min(18, remaining)
  const progressRatio = totalArtists ? Math.min(visibleCount / totalArtists, 1) : 0
  const remainingAfterNext = Math.max(remaining - nextBatchSize, 0)
  const progressWidth = progressRatio > 0 ? Math.max(6, progressRatio * 100) : 0
  const loadMoreHelper = remainingAfterNext > 0 ? `${remainingAfterNext} more after this batch.` : 'You\'re about to see the full list.'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-white/70">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          Preparing the live charts…
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030303] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-[28rem] w-[28rem] rounded-full bg-cyan-500/5 blur-[160px]" />
        <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-widest text-white/60">
              <Disc3 className="h-3.5 w-3.5 text-emerald-300" />
              Top Artists Live Pulse
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              World&apos;s Top Artists
            </h1>
            <p className="max-w-2xl text-sm text-white/60 sm:text-base">
              Real-time analytics and insights dashboard on the top 500 artists globally. Track
              listener growth, momentum, and breakout stars as they emerge.
            </p>
          </div>
          <div className="flex w-full flex-col gap-4 md:w-[18rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Search by artist name…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-12 rounded-full border-white/10 bg-white/10 pl-11 text-white placeholder:text-white/40 focus-visible:ring-emerald-400"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-widest">Dataset</span>
                <Badge variant="muted" className="rounded-full border-white/10 bg-white/10 text-[11px] text-white/70">
                  {artists.length} artists
                </Badge>
              </div>
              <Separator className="my-3 border-white/10" />
              <div className="flex items-center justify-between text-white/70">
                <span className="inline-flex items-center gap-2">
                  <CalendarCheck className="h-3.5 w-3.5 text-emerald-300" />
                  Last ingest
                </span>
                <span>{lastUpdated ? new Date(lastUpdated).toLocaleDateString() : '—'}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                asChild
                variant="secondary"
                className="group inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-white/15 bg-emerald-400/15 text-sm font-semibold text-white hover:bg-emerald-400/25"
              >
                <Link href="/world-map">
                  <Globe2 className="h-4 w-4 text-emerald-200 transition-transform group-hover:scale-110" />
                  Explore world atlas
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                className="group inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-white/15 bg-white/10 text-sm font-semibold text-white hover:bg-white/20"
              >
                <Link href="/former">
                  <History className="h-4 w-4 text-white/70 transition-transform group-hover:scale-110" />
                  Former artists archive
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24">
        <section className="grid gap-4 py-10 md:grid-cols-4">
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest text-white/50">
                Total monthly listeners
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-white">
                {formatNumber(Math.round(metrics.totalMonthlyListeners))}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-white/50">
              Across the current top 500 catalogue.
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest text-white/50">
                Average momentum
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-white">
                {metrics.avgMomentum ? metrics.avgMomentum.toFixed(1) : '—'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-xs text-white/50">
              <Activity className="h-3.5 w-3.5 text-emerald-300" />
              Momentum blends growth, freshness, and streak strength.
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest text-white/50">
                Fastest 7-day climb
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-white">
                {metrics.topGrowth ? `${formatNumber(metrics.topGrowth.g7)} list.` : '—'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-xs text-white/50">
              <span>
                {metrics.topGrowth ? metrics.topGrowth.n : 'Awaiting arrivals'}
              </span>
              {metrics.topGrowth && (
                <Badge variant="muted" className="rounded-full border-white/10 bg-emerald-400/10 text-[11px] text-emerald-200">
                  +{formatNumber(metrics.topGrowth.g1)} today
                </Badge>
              )}
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest text-white/50">
                Breakout artists
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-white">
                {metrics.freshCount}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-xs text-white/50">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-300" />
              Freshness score ≥ 70 today.
            </CardContent>
          </Card>
        </section>

        {spotlight && (
          <section className="mb-12 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 backdrop-blur">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20 ring-2 ring-white/20 ring-offset-4 ring-offset-black/40">
                  <AvatarImage
                    src={`https://i.scdn.co/image/${spotlight.p}`}
                    alt={spotlight.n}
                    onError={(event) => {
                      event.currentTarget.src = '/placeholder-artist.svg'
                    }}
                  />
                  <AvatarFallback>{spotlight.n.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">Spotlight</p>
                  <h2 className="text-3xl font-semibold text-white">{spotlight.n}</h2>
                  <p className="text-sm text-white/60">
                    #{spotlight.r} • {formatNumber(spotlight.ml)} monthly listeners • {formatNumber(spotlight.g7)} gained in 7 days
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 text-sm text-white/70 md:text-right">
                <div className="flex items-center gap-2 md:justify-end">
                  <TrendingUp className="h-4 w-4 text-emerald-300" />
                  Momentum {spotlight.ms ? spotlight.ms.toFixed(1) : '—'}
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <Globe2 className="h-4 w-4 text-emerald-300" />
                  {spotlight.st} day streak in the global 500
                </div>
                <Button
                  asChild
                  variant="secondary"
                  className="group inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-white/15 bg-emerald-400/15 text-sm font-semibold text-white hover:bg-emerald-400/25"
                >
                  <Link href={`/artist/${spotlight.i}` } target="_blank" rel="noopener noreferrer">Open artist dashboard<ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        )}

        <section>
          <Tabs value={view} onValueChange={(value) => setView(value as ViewKey)} className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                {Object.entries(viewConfig).map(([key, { label }]) => (
                  <TabsTrigger key={key} value={key} className="text-sm">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <p className="text-sm text-white/50 text-center">{viewConfig[view].description}</p>
            </div>

            <TabsContent value={view}>
              <ScrollArea className="max-h-[none]">
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {orderedArtists.slice(0, visibleCount).map((artist) => (
                    <ArtistCard key={artist.i} artist={artist} />
                  ))}
                </div>
              </ScrollArea>
              {orderedArtists.length === 0 && (
                <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-white/60">
                  No artists match your filters. Try a different search.
                </div>
              )}
              {orderedArtists.length > visibleCount && (
                <div className="mt-10 flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-black/40 p-6 text-sm text-white/70 shadow-lg shadow-black/30">
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/40">
                      <span>Viewing</span>
                      <span>
                        {Math.min(visibleCount, totalArtists)} / {totalArtists}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400/70 transition-all"
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="group rounded-full border-white/10 bg-emerald-400/15 px-6 py-2 text-white transition-all hover:bg-emerald-400/25"
                    onClick={() =>
                      setVisibleCount((previous) => Math.min(previous + 18, totalArtists))
                    }
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      Reveal next {nextBatchSize || 18} artists
                      <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                    </span>
                  </Button>
                  <p className="text-xs text-white/45">{loadMoreHelper}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  )
}
