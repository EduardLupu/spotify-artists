'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
    Activity,
    ArchiveRestore,
    ArrowUpRight, CalendarCheck,
    CalendarClock,
    Clock4,
    Filter,
    Search,
} from 'lucide-react'

import type { FormerArtist } from '@/lib/data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Navbar from "@/components/navbar";
import {Separator} from "@/components/ui/separator";

type SortKey = 'recent' | 'listeners' | 'followers' | 'absence' | 'name' | 'rank'

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  if (value === 0) return '0'
  if (value < 1000) return `${value}`
  return compactNumber.format(value)
}

function formatDate(iso: string | null) {
  if (!iso) return 'Unknown'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return 'Unknown'
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

function formatDaysLabel(days: number | null) {
  if (days === null || Number.isNaN(days)) return 'Unknown absence'
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function formatDaysCount(days: number | null) {
  if (days === null || Number.isNaN(days)) return '—'
  return `${days} days`
}

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recently dropped' },
  { value: 'listeners', label: 'Monthly listeners' },
  { value: 'followers', label: 'Followers' },
  { value: 'absence', label: 'Longest absence' },
  { value: 'rank', label: 'Best historical rank' },
  { value: 'name', label: 'Alphabetical' },
]

type FormerArtistsClientProps = {
  artists: FormerArtist[]
  generatedAt: string
}

export default function FormerArtistsClient({ artists, generatedAt }: FormerArtistsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recent')

  const lastUpdated = useMemo(() => {
    if (!generatedAt) return '—'
    const parsed = new Date(generatedAt)
    if (Number.isNaN(parsed.getTime())) return generatedAt
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  }, [generatedAt])

  const stats = useMemo(() => {
    if (!artists.length) {
      return {
        total: 0,
        recent: 0,
        medianDays: null as number | null,
        averageDays: null as number | null,
        longest: null as number | null,
      }
    }
    const daySamples = artists
      .map((artist) => artist.daysSince)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .sort((a, b) => a - b)

    const sum = daySamples.reduce((acc, value) => acc + value, 0)
    const median =
      daySamples.length === 0
        ? null
        : daySamples.length % 2 === 0
          ? Math.round((daySamples[daySamples.length / 2 - 1] + daySamples[daySamples.length / 2]) / 2)
          : daySamples[Math.floor(daySamples.length / 2)]

    return {
      total: artists.length,
      recent: artists.filter((artist) => typeof artist.daysSince === 'number' && artist.daysSince <= 30).length,
      medianDays: median,
      averageDays: daySamples.length ? Math.round(sum / daySamples.length) : null,
      longest: daySamples.length ? daySamples[daySamples.length - 1] : null,
    }
  }, [artists])

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    let base = artists
    if (query) {
      base = artists.filter((artist) => artist.name.toLowerCase().includes(query))
    }
    const sorted = [...base]

    const alphabetic = (a: FormerArtist, b: FormerArtist) => a.name.localeCompare(b.name)

    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'listeners': {
          const aScore = typeof a.monthlyListeners === 'number' ? a.monthlyListeners : -1
          const bScore = typeof b.monthlyListeners === 'number' ? b.monthlyListeners : -1
          if (bScore !== aScore) return bScore - aScore
          return alphabetic(a, b)
        }
        case 'followers': {
          const aScore = typeof a.followers === 'number' ? a.followers : -1
          const bScore = typeof b.followers === 'number' ? b.followers : -1
          if (bScore !== aScore) return bScore - aScore
          return alphabetic(a, b)
        }
        case 'absence': {
          const aScore = typeof a.daysSince === 'number' ? a.daysSince : -1
          const bScore = typeof b.daysSince === 'number' ? b.daysSince : -1
          if (bScore !== aScore) return bScore - aScore
          return alphabetic(a, b)
        }
        case 'rank': {
          const aScore = typeof a.bestRank === 'number' ? a.bestRank : Number.POSITIVE_INFINITY
          const bScore = typeof b.bestRank === 'number' ? b.bestRank : Number.POSITIVE_INFINITY
          if (aScore !== bScore) return aScore - bScore
          return alphabetic(a, b)
        }
        case 'name':
          return alphabetic(a, b)
        case 'recent':
        default: {
          const aScore = typeof a.daysSince === 'number' ? a.daysSince : Number.POSITIVE_INFINITY
          const bScore = typeof b.daysSince === 'number' ? b.daysSince : Number.POSITIVE_INFINITY
          if (aScore !== bScore) return aScore - bScore
          return alphabetic(a, b)
        }
      }
    })

    return sorted
  }, [artists, searchTerm, sortKey])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020202] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-16 h-[22rem] w-[22rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[26rem] w-[26rem] rounded-full bg-teal-500/10 blur-[180px]" />
        <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black via-black/70 to-transparent" />
      </div>

      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div className="inline-flex h-6 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.35em] text-white/60">
                  <ArchiveRestore className="h-3.5 w-3.5 text-emerald-300" />
                  Former 500
              </div>
                <Navbar />
            </div>
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between py-7">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Former Top Artists</h1>
                        <p className="max-w-2xl text-sm text-white/60 sm:text-base">
                            These artists once ranked inside the global Top 500. Track how long they&apos;ve been absent,
                            when they last appeared, and where their audience stands today.
                        </p>
                    </div>
                    <div className="flex w-full flex-col gap-4 md:w-[18rem]">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
                            <div className="flex items-center justify-between">
                                <span className="uppercase tracking-widest">Dataset</span>
                                <Badge variant="muted" className="rounded-full border-white/10 bg-white/10 text-[11px] text-white/70">
                                    {stats.total} former artists
                                </Badge>
                            </div>
                            <Separator className="my-3 border-white/10" />
                            <div className="flex items-center justify-between text-white/70">
                    <span className="inline-flex items-center gap-2">
                      <CalendarCheck className="h-3.5 w-3.5 text-emerald-300" />
                      Last update
                    </span>
                                <span>{lastUpdated ? new Date(lastUpdated).toLocaleDateString() : '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="grid gap-4 py-10 md:grid-cols-4">
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest text-white/45">
                Former artists tracked
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-white">
                {stats.total}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-white/50">
              Artists currently outside the Top 500.
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest text-white/45">
                Dropped in last 30 days
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-white">
                {stats.recent}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-xs text-white/50">
              <Activity className="h-3.5 w-3.5 text-emerald-300" />
              Most recent departures from the Top 500.
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest text-white/45">
                Median absence
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-white">
                {formatDaysCount(stats.medianDays)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-white/50">
              Half the archive has been absent this long or less.
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest text-white/45">
                Longest absence
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-white">
                {formatDaysCount(stats.longest)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-xs text-white/50">
              <Clock4 className="h-3.5 w-3.5 text-emerald-300" />
              Longest time out of the Top 500.
            </CardContent>
          </Card>
        </section>

        <section className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search former artists…"
                className="h-12 rounded-full border-white/10 bg-white/10 pl-12 text-white placeholder:text-white/40 focus-visible:ring-emerald-400"
              />
            </div>
            <p className="mt-2 text-xs text-white/40">{filtered.length} artists match your filters.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Filter className="h-4 w-4 text-white/40" />
              Sort by
            </div>
            <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
              <SelectTrigger className="h-12 w-full rounded-full border-white/10 bg-white/10 text-white placeholder:text-white/50 focus:ring-emerald-400 focus:ring-offset-0 sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0f0f0f] text-white">
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((artist) => (
            <FormerArtistCard key={artist.id} artist={artist} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full flex h-48 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/40 text-sm text-white/60">
              No former artists match your search. Try a different query.
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function FormerArtistCard({ artist }: { artist: FormerArtist }) {
  const imageSrc = artist.imageHash ? `https://i.scdn.co/image/${artist.imageHash}` : undefined
  const lastSeen = formatDate(artist.lastTop500)
  const absenceLabel = formatDaysLabel(artist.daysSince)

  return (
  <Link href={`/artist/${artist.id}`} className="group">
    <Card className="relative h-full overflow-hidden border-white/10 bg-white/5 backdrop-blur transition-all duration-300 hover:border-white/20 hover:bg-white/10">
      <div className="absolute -right-10 top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl transition-opacity" />
      <CardHeader className="flex flex-row items-start gap-4 pb-4">
        <div className="relative">
          <Avatar className="h-16 w-16 ring-1 ring-white/10 ring-offset-2 ring-offset-black/40">
            {imageSrc ? (
              <AvatarImage
                src={imageSrc}
                alt={artist.name}
                className="object-cover"
                onError={(event) => {
                  event.currentTarget.src = '/placeholder-artist.svg'
                }}
              />
            ) : (
              <AvatarImage src="/placeholder-artist.svg" alt={artist.name} />
            )}
            <AvatarFallback>{artist.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 space-y-2">
            <CardTitle className="flex items-center justify-between text-lg font-semibold leading-6 text-white">
                <span>{artist.name}</span>
            </CardTitle>
            <CardDescription className="text-sm text-white/60">
                {absenceLabel}
            </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm text-white/80">
          <StatBlock label="Monthly listeners" value={formatNumber(artist.monthlyListeners)} />
          <StatBlock label="Followers" value={formatNumber(artist.followers)} />
          <StatBlock
            label="Peak rank"
            value={artist.bestRank ? `#${artist.bestRank}` : '—'}
          />
          <StatBlock
            label="Days since seen"
            value={artist.daysSince !== null ? `${artist.daysSince}` : '—'}
          />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between text-xs text-white/55">
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-emerald-300" />
          Last seen {lastSeen}
        </span>
      <span className="inline-flex items-center gap-1 text-emerald-200/70">
          Detail
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </CardFooter>
    </Card>
    </Link>
  )
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
    </div>
  )
}
