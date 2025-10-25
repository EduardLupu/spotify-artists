'use client'

import {useEffect, useMemo, useRef, useState} from 'react'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'

import {
    Activity,
    ArrowLeft,
    ArrowUpRight,
    Clock,
    Compass,
    Disc3,
    Flame,
    Gauge,
    Loader2,
    Music4,
    Pause,
    Play,
    Sparkles,
    TrendingUp,
    Users,
} from 'lucide-react'

import {ArtistChart} from '@/components/artist-chart'
import {TopCities} from '@/components/top-cities'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Separator} from '@/components/ui/separator'

type SeriesPayload = {
    fields: string[]
    rows: any[][]
    b?: string
    step?: string
}

interface ArtistDetail {
    v: number
    i: string
    n: string
    p: string
    today: {
        d: string
        r: number | null
        ml: number | null
        f: number | null
        dr: number | null
        g1: number
        g7: number
        g30: number
        fs: number
        ms: number
    }
    meta: {
        firstSeen: string
        first500: string | null
        last500: string | null
        timesEntered500: number
        days500: number
        br: number | null
    }
    series?: SeriesPayload
    series30?: SeriesPayload
    gallery?: string[]
    singles?: {
        fields: string[]
        rows: any[][]
    }
    topTracks?: {
        fields: string[]
        rows: any[][]
    }
    topCities?: {
        fields: string[]
        rows: any[][]
    }
    bio: string
}

interface CityDirectoryEntry {
    cid: number
    name: string
    cc: string
    lat: number
    lon: number
}

interface TrackItem {
    id: string
    name: string
    playcount: number
    image: string | null
    preview: string | null
    canvas: string | null
    licensor: string | null
    language: string | null
    isrc: string | null
    label: string | null
    releaseDate: string | null
}

const numberFormatter = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0})

function formatNumber(value: number | null | undefined) {
    if (value === null || value === undefined) return '—'
    if (value === 0) return '0'
    if (Math.abs(value) < 1000) {
        return Number.isInteger(value) ? `${value}` : value.toFixed(1)
    }
    return numberFormatter.format(Math.round(value))
}

function formatDate(value: string | null | undefined) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('en', {year: 'numeric', month: 'short', day: 'numeric'})
}

function formatRankDelta(delta: number | null | undefined) {
    if (delta === null || delta === undefined) return '–'
    if (delta === 0) return '±0'
    return `${delta > 0 ? '+' : ''}${delta}`
}

export default function ArtistPage() {
    const search = useSearchParams()
    const artistId = search.get('id') ?? undefined

    const [artist, setArtist] = useState<ArtistDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [cityDirectory, setCityDirectory] = useState<Record<number, CityDirectoryEntry>>({})
    const [appleMetadata, setAppleMetadata] = useState<{ genre?: string; url?: string } | null>(null)
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        const fetchDirectory = async () => {
            try {
                const response = await fetch('/data/latest/geo-cities.json')
                if (!response.ok) return
                const payload = await response.json()
                const entries: Record<number, CityDirectoryEntry> = {}
                payload.rows.forEach((row: any[]) => {
                    entries[row[0]] = {
                        cid: row[0],
                        name: row[1],
                        cc: row[2],
                        lat: row[3],
                        lon: row[4],
                    }
                })
                setCityDirectory(entries)
            } catch (directoryError) {
                console.error('Failed to load geo directory', directoryError)
            }
        }
        fetchDirectory()
    }, [])

    useEffect(() => {
        if (!artistId) return

        const fetchArtistDetail = async () => {
            setLoading(true)
            try {
                const response = await fetch(`/data/artists/${artistId.slice(0, 2).toLowerCase()}/${artistId}.json`)
                if (!response.ok) {
                    throw new Error('Artist not found')
                }
                const data: ArtistDetail = await response.json()
                setArtist(data)
                setError(null)
            } catch (fetchError) {
                console.error('Failed to fetch artist detail', fetchError)
                setError('Artist not found')
                setArtist(null)
            } finally {
                setLoading(false)
            }
        }

        fetchArtistDetail()
    }, [artistId])

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (!artist?.n) {
            setAppleMetadata(null)
            return
        }

        const controller = new AbortController()
        const searchTerm = encodeURIComponent(artist.n.replace(/&/g, ' '))
        const lookupUrl = `https://itunes.apple.com/search?term=${searchTerm}&entity=musicArtist&limit=1`

        fetch(lookupUrl, {signal: controller.signal})
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Apple Music lookup failed')
                }
                return response.json()
            })
            .then((payload) => {
                const result = payload?.results?.[0]
                if (!result) {
                    setAppleMetadata(null)
                    return
                }

                setAppleMetadata({
                    genre: result.primaryGenreName ?? undefined,
                    url: result.artistLinkUrl ?? undefined,
                })
            })
            .catch((itunesError: unknown) => {
                if ((itunesError as Error)?.name === 'AbortError') {
                    return
                }
                console.error('Failed to enrich Apple Music metadata', itunesError)
                setAppleMetadata(null)
            })

        return () => {
            controller.abort()
        }
    }, [artist?.n])

    const topTracks: TrackItem[] = useMemo(() => {
        if (!artist?.topTracks?.rows?.length) return []
        return artist.topTracks.rows.map((row) => ({
            id: row[0] as string,
            name: row[1] as string,
            playcount: row[2] as number,
            image: row[3] as string | null,
            preview: row[4] as string | null,
            licensor: row[5] as string | null,
            language: row[6] as string | null,
            isrc: row[7] as string | null,
            label: row[8] as string | null,
            releaseDate: row[9] as string | null,
            canvas: row[10] as string | null,
        }))
    }, [artist])

    const cityRows = useMemo(() => {
        if (!artist?.topCities?.rows?.length) return []
        return artist.topCities.rows
            .map((row) => ({
                cid: row[0] as number,
                listeners: row[1] as number,
            }))
            .filter((row) => !!cityDirectory[row.cid])
    }, [artist, cityDirectory])

    const galleryImages = useMemo(() => {
        if (!artist?.gallery?.length) return []
        return artist.gallery.slice(0, 6).map((id) =>
            id.startsWith('http') ? id : `https://i.scdn.co/image/${id}`
        )
    }, [artist])

    const heroImage =
        galleryImages[0] ??
        (artist?.p ? `https://i.scdn.co/image/${artist.p}` : '/placeholder-artist.svg')

    const statHighlights = useMemo(() => {
        if (!artist) return []
        return [
            {
                label: 'Monthly listeners',
                value: formatNumber(artist.today.ml),
                hint: 'Real-time Spotify listeners',
                icon: Users,
            },
            {
                label: 'Followers',
                value: formatNumber(artist.today.f),
                hint: 'Total Spotify followers',
                icon: Disc3,
            },
            {
                label: 'Freshness score',
                value: `${Math.round(artist.today.fs ?? 0)}`,
                hint: 'Higher = stronger momentum for new releases',
                icon: Sparkles,
            },
            {
                label: 'Momentum index',
                value: artist.today.ms ? artist.today.ms.toFixed(1) : '—',
                hint: 'Composite score across growth signals',
                icon: Activity,
            },
        ]
    }, [artist])

    const growthMetrics = useMemo(() => {
        if (!artist) return []
        return [
            {label: '24h listeners', value: formatNumber(artist.today.g1), icon: Clock},
            {label: '7d listeners', value: formatNumber(artist.today.g7), icon: TrendingUp},
            {label: '30d listeners', value: formatNumber(artist.today.g30), icon: Flame},
        ]
    }, [artist])

    const metaRows = useMemo(() => {
        if (!artist) return []
        return [
            {label: 'First seen', value: formatDate(artist.meta.firstSeen)},
            {label: 'First top 500 entry', value: formatDate(artist.meta.first500)},
            {label: 'Most recent top 500 exit', value: formatDate(artist.meta.last500)},
            {label: 'Times entered', value: `${artist.meta.timesEntered500}`},
            {label: 'Days in chart', value: `${artist.meta.days500} days`},
            {label: 'Best rank', value: artist.meta.br ? `#${artist.meta.br}` : '—'},
        ]
    }, [artist])

    const handleToggleTrack = (track: TrackItem) => {
        if (!track.preview) return

        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            audioRef.current = null
        }

        const isCurrent = currentTrackId === track.id && isPlaying
        if (isCurrent) {
            setIsPlaying(false)
            setCurrentTrackId(null)
            return
        }

        const audio = new Audio(`https://p.scdn.co/mp3-preview/${track.preview}`)
        audioRef.current = audio
        audio
            .play()
            .then(() => {
                setIsPlaying(true)
                setCurrentTrackId(track.id)
            })
            .catch((playError) => {
                console.error('Audio playback failed', playError)
                setIsPlaying(false)
                setCurrentTrackId(null)
            })

        const teardown = () => {
            setIsPlaying(false)
            setCurrentTrackId(null)
        }

        audio.addEventListener('ended', teardown)
        audio.addEventListener('error', teardown)
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white/70">
                <div
                    className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-400"/>
                    Fetching artist telemetry…
                </div>
            </div>
        )
    }

    if (error || !artist) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#050505] text-white">
                <Card className="w-full max-w-md border-white/10 bg-white/5 p-8 text-center">
                    <div
                        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
                        <Music4 className="h-8 w-8"/>
                    </div>
                    <CardTitle className="mt-6 text-2xl">Artist not found</CardTitle>
                    <CardDescription className="mt-2 text-white/60">
                        We couldn’t locate that Spotify artist. Try searching from the global dashboard.
                    </CardDescription>
                    <div className="mt-6">
                        <Button asChild variant="secondary"
                                className="rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20">
                            <Link href="/">Back to dashboard</Link>
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="relative min-h-screen bg-[#050505] text-white">
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-transparent to-black"/>
            <div className="relative z-10 min-h-screen">
                <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
                        <Button
                            asChild
                            variant="ghost"
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                        >
                            <Link href="/">
                                <ArrowLeft className="h-4 w-4"/>
                                Back to artists
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3 text-sm text-white/70">
                            <div
                                className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                                <Disc3 className="h-3.5 w-3.5"/>
                                Live dataset
                            </div>
                            <Separator orientation="vertical" className="h-5 border-white/10"/>
                            <span>{formatDate(artist.today.d)}</span>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-6xl px-4 pb-24">
                    <section className="relative mt-10 overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                        <div className="absolute inset-0">
                            <div
                                className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_55%)]"/>
                            <div className="absolute inset-0 opacity-60">
                                <div className="absolute inset-0 grid grid-cols-3 gap-3">
                                    {galleryImages.map((url, index) => (
                                        <div
                                            key={url + index}
                                            className="relative overflow-hidden rounded-[2rem]"
                                            style={{animationDelay: `${index * 0.1}s`}}
                                        >
                                            <img
                                                src={url}
                                                alt={`${artist.n} gallery ${index + 1}`}
                                                style={{transitionDuration: '7000ms'}}
                                                className="h-full w-full object-cover transition-transform ease-linear will-change-transform group-hover:scale-105"
                                                onError={(event) => {
                                                    event.currentTarget.style.display = 'none'
                                                }}
                                            />
                                            <div
                                                className="absolute inset-0 bg-gradient-to-tr from-black via-black/70 to-transparent"/>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div
                                className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black/80 backdrop-blur-3xl"/>
                        </div>

                        <div
                            className="relative z-10 flex flex-col gap-8 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
                            <div className="flex flex-1 flex-col gap-6 md:flex-row md:items-center">
                                <div className="relative shrink-0">
                                    <div
                                        className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/30 blur-3xl"/>
                                    <img
                                        src={heroImage}
                                        alt={artist.n}
                                        className="relative h-32 w-32 rounded-3xl border border-white/20 object-cover shadow-2xl shadow-black/60 md:h-40 md:w-40"
                                        onError={(event) => {
                                            event.currentTarget.src = '/placeholder-artist.svg'
                                        }}
                                    />
                                    {artist.today.r && (
                                        <Badge
                                            className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border-none bg-emerald-400/90 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-950 shadow-lg shadow-emerald-500/30">
                                            #{artist.today.r}
                                        </Badge>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div
                                        className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.4em] text-white/60">
                                        <Compass className="h-3.5 w-3.5 text-emerald-300"/>
                                        Artist profile
                                    </div>
                                    <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{artist.n}</h1>
                                    <p className="max-w-xl text-xs text-white/70">
                                        {artist.bio}
                                    </p>
                                    <div
                                        className="flex flex-wrap gap-3 text-xs uppercase tracking-widest text-white/60">
                    <span
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      <Gauge className="h-3.5 w-3.5 text-emerald-300"/>
                      Momentum {artist.today.ms ? artist.today.ms.toFixed(1) : '—'}
                    </span>
                                        <span
                                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-300"/>
                      Rank delta {formatRankDelta(artist.today.dr)}
                    </span>
                                        <span
                                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      <Flame className="h-3.5 w-3.5 text-emerald-300"/>
                                            {artist.meta.days500} days in global 500
                    </span>
                                        {appleMetadata?.genre && (
                                            <span
                                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        <Music4 className="h-3.5 w-3.5 text-emerald-300"/>
                        Genre {appleMetadata.genre}
                      </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-start gap-4 text-sm text-white/70 md:items-end">
                                <div
                                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left md:text-right">
                                    <p className="text-xs uppercase tracking-widest text-white/50">Latest trend</p>
                                    <p className="mt-1 text-lg font-semibold text-white">
                                        {formatNumber(artist.today.g7)} listeners this week
                                    </p>
                                    <p className="text-xs text-white/60">
                                        {formatNumber(artist.today.g1)} in the last 24 hours
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        asChild
                                        variant="secondary"
                                        className="rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20"
                                    >
                                        <a
                                            href={`https://open.spotify.com/artist/${artist.i}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2"
                                        >
                                            Spotify
                                            <ArrowUpRight className="h-4 w-4"/>
                                        </a>
                                    </Button>
                                    {appleMetadata?.url && (
                                        <Button
                                            asChild
                                            variant="ghost"
                                            className="rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                        >
                                            <a
                                                href={appleMetadata.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2"
                                            >
                                                Apple Music
                                                <ArrowUpRight className="h-4 w-4"/>
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {statHighlights.map(({label, value, hint, icon: Icon}) => (
                            <Card key={label} className="border-white/10 bg-white/5 backdrop-blur">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardDescription className="text-xs uppercase tracking-widest text-white/60">
                                        {label}
                                    </CardDescription>
                                    <Icon className="h-4 w-4 text-emerald-300"/>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold text-white">{value}</div>
                                    <p className="mt-2 text-xs text-white/50">{hint}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </section>

                    <section className="mt-6 grid gap-4 sm:grid-cols-3">
                        {growthMetrics.map(({label, value, icon: Icon}) => (
                            <Card key={label} className="border-white/10 bg-black/40">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardDescription className="text-xs uppercase tracking-widest text-white/60">
                                        {label}
                                    </CardDescription>
                                    <Icon className="h-4 w-4 text-emerald-300"/>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        className={`text-xl font-semibold ${value.startsWith('-') ? 'text-rose-200' : 'text-emerald-200'}`}>
                                        {value}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </section>

                    <section className="mt-10 grid gap-6 lg:grid-cols-[2.1fr_1fr]">
                        <Card className="border-white/10 bg-black/40">
                            <CardHeader className="flex flex-col gap-1">
                                <div
                                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-white/60">
                                    <Activity className="h-3.5 w-3.5 text-emerald-300"/>
                                    Performance history
                                </div>
                                <CardTitle className="text-2xl text-white">Ranking trajectory</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ArtistChart seriesData={artist.series ?? artist.series30} artistName={artist.n}/>
                            </CardContent>
                        </Card>

                        <Card className="border-white/10 bg-white/5 backdrop-blur">
                            <CardHeader>
                                <CardTitle className="text-xl text-white">Career milestones</CardTitle>
                                <CardDescription className="text-sm text-white/60">
                                    Key timestamps and chart achievements for {artist.n}.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm text-white/80">
                                {metaRows.map(({label, value}) => (
                                    <div key={label}
                                         className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                                        <span className="text-white/60">{label}</span>
                                        <span className="font-medium text-white">{value}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </section>

                    {topTracks.length > 0 && (
                        <section className="mt-10 grid gap-6 lg:grid-cols-[2.1fr_1fr]">
                            <Card className="border-white/10 bg-black/40">
                                <CardHeader className="flex flex-col gap-1">
                                    <div
                                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-white/60">
                                        <Music4 className="h-3.5 w-3.5 text-emerald-300"/>
                                        Top tracks
                                    </div>
                                    <CardTitle className="text-2xl text-white">Most streamed catalogue</CardTitle>
                                    <CardDescription className="text-sm text-white/60">
                                        Preview snippets when available. Canvas loops render on active tracks.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-[520px] pr-3 md:px-2">
                                        <div className="flex flex-col gap-3 pb-1 mr-2">
                                            {topTracks.map((track, index) => {
                                                const isActive = currentTrackId === track.id && isPlaying

                                                return (
                                                    <div
                                                        key={track.id}
                                                        className={[
                                                            "group relative grid grid-cols-[auto,1fr,auto] items-center",
                                                            "gap-5 rounded-3xl border border-white/10 bg-white/[0.04]",
                                                            "p-4 md:p-5 transition-all duration-200",
                                                            "hover:border-emerald-400/40 hover:bg-emerald-400/[0.06] hover:shadow-lg hover:shadow-emerald-500/5",
                                                        ].join(" ")}
                                                    >
                                                        {/* animated canvas background */}
                                                        {isActive && track.canvas && (
                                                            <div
                                                                className="pointer-events-none absolute inset-0 -z-10 opacity-35">
                                                                <video
                                                                    src={track.canvas}
                                                                    autoPlay
                                                                    loop
                                                                    muted
                                                                    playsInline
                                                                    className="h-full w-full object-cover rounded-3xl"
                                                                />
                                                                <div
                                                                    className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/30 to-black/40 backdrop-blur-[1px]"/>
                                                            </div>
                                                        )}

                                                        {/* cover + overlay play state */}
                                                        <div
                                                            className="relative h-18 w-18 md:h-20 md:w-20 overflow-hidden rounded-2xl border border-white/10">
                                                            <img
                                                                src={track.image ? `https://i.scdn.co/image/${track.image}` : "/placeholder-artist.svg"}
                                                                alt={track.name}
                                                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                                onError={(e) => {
                                                                    e.currentTarget.src = "/placeholder-artist.svg"
                                                                }}
                                                            />
                                                            {/* active state veil */}
                                                            {isActive && (
                                                                <div
                                                                    className="absolute inset-0 grid place-items-center bg-black/50 text-emerald-300">
                                                                    <Disc3 className="h-5 w-5 animate-spin"/>
                                                                </div>
                                                            )}

                                                            {!isActive && (
                                                                <button
                                                                    onClick={() => handleToggleTrack(track)}
                                                                    disabled={!track.preview}
                                                                    className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                                                                    aria-label="Play preview"
                                                                >
              <span className="rounded-full bg-black/60 p-2 ring-1 ring-white/10">
                <Play className="h-5 w-5 text-white"/>
              </span>
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* middle column */}
                                                        <div className="min-w-0">
                                                            <div
                                                                className="flex flex-wrap items-baseline justify-between gap-2">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <h3 className="text-base font-semibold text-white hover:underline cursor-pointer hover:underline-offset-4 line-clamp-2">
                                                                            <a
                                                                                href={`https://open.spotify.com/track/${track.id}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="block line-clamp-2"
                                                                            >
                                                                                {track.name}
                                                                            </a>
                                                                        </h3>
                                                                    </div>
                                                                    <p className="mt-1 line-clamp-1 text-[11px] uppercase tracking-wide text-white/50">
                                                                        {track.label ?? "Independent"} • {track.language?.toUpperCase() || "EN"}
                                                                    </p>
                                                                </div>

                                                                <div
                                                                    className="shrink-0 text-right text-xs text-white/60">
                                                                    <p className="font-semibold text-white/80">
                                                                        {formatNumber(track.playcount)} plays
                                                                    </p>
                                                                    <p>{formatDate(track.releaseDate)}</p>
                                                                </div>
                                                            </div>

                                                        <div
                                                            className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-white/40">
                                                            {track.isrc && (
                                                                <span
                                                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {track.isrc}
              </span>
                                                            )}
                                                            {track.licensor && (
                                                                <span
                                                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {track.licensor}
              </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                {/* right actions */
                                                }
                                                <div
                                                    className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                                                    <Button
                                                        variant="secondary"
                                                        size="icon"
                                                        className="rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20"
                                                        onClick={() => handleToggleTrack(track)}
                                                        disabled={!track.preview}
                                                        aria-label={isActive ? "Pause" : "Play"}
                                                    >
                                                    {isActive ? <Pause className="h-5 w-5"/> :
                                                                    <Play className="h-5 w-5"/>}
                                                            </Button>
                                                        </div>

                                                        {/* subtle focus/hover ring */}
                                                        <span
                                                            className="pointer-events-none absolute inset-0 rounded-3xl ring-0 ring-emerald-400/30 transition-all duration-200 group-hover:ring-2"/>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            <Card className="border-white/10 bg-white/5 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-xl text-white">Chart streak</CardTitle>
                                    <CardDescription className="text-sm text-white/60">
                                        Daily ranking cadence and time spent within top 500.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm text-white/70">
                                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                                        <p className="text-xs uppercase tracking-widest text-white/50">Current
                                            streak</p>
                                        <p className="mt-1 text-lg font-semibold text-white">{artist.meta.days500} days</p>
                                        <p className="text-xs text-white/50">
                                            {artist.meta.timesEntered500} total entries into the global 500.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                                        <p className="text-xs uppercase tracking-widest text-white/50">Best global
                                            rank</p>
                                        <p className="mt-1 text-lg font-semibold text-white">
                                            {artist.meta.br ? `#${artist.meta.br}` : '—'}
                                        </p>
                                        <p className="text-xs text-white/50">Rank delta
                                            today {formatRankDelta(artist.today.dr)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    )}

                    {cityRows.length > 0 && (
                        <section className="mt-12">
                            <TopCities artistName={artist.n} cityRows={cityRows} directory={cityDirectory}/>
                        </section>
                    )}

                    {galleryImages.length > 0 && (
                        <section className="mt-10">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-lg font-semibold text-white">Photo preview</h2>
                                <span className="text-xs uppercase tracking-widest text-white/50">
                  {galleryImages.length} assets
                </span>
                            </div>
                            <ScrollArea orientation="horizontal" className="mt-4 w-full">
                                <div className="flex w-max gap-4 pb-3 pr-4">
                                    {galleryImages.map((url, index) => (
                                        <div
                                            key={`${url}-${index}`}
                                            className="group relative h-36 w-[10.5rem] overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-lg transition-transform duration-300 hover:-translate-y-1 hover:border-emerald-400/40 sm:h-44 sm:w-[13rem]"
                                        >
                                            <img
                                                src={url}
                                                alt={`${artist.n} preview ${index + 1}`}
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                onError={(event) => {
                                                    event.currentTarget.style.display = 'none'
                                                }}
                                            />
                                            <div
                                                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 opacity-60"/>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </section>
                    )}
                </main>
            </div>
        </div>
    )
}
