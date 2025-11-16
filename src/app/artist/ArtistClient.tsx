'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import Link from 'next/link'

import {
    Activity,
    ArrowLeft,
    ArrowRight,
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
    Shuffle,
    Sparkles,
    TrendingUp,
    Users,
    X,
} from 'lucide-react'

import {ArtistChart} from '@/components/artist-chart'
import {TopCities} from '@/components/top-cities'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {ScrollArea} from '@/components/ui/scroll-area'
import {cn} from '@/lib/utils'
import Navbar from "@/components/navbar";

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
        ml: number
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
    chartSnapshots?: Record<string, { chartType?: string; rows?: Array<Record<string, unknown>> }>
    playlists?: {
        fields: string[]
        rows: any[][]
    }
}

interface CityDirectoryEntry {
    cid: number
    name: string
    cc: string
    lat: number
    lon: number
}

type PlayableTrack = {
    id: string
    preview: string | null
    canvas?: string | null
}

interface TrackItem extends PlayableTrack {
    name: string
    playcount: number
    image: string | null
    licensor: string | null
    language: string | null
    isrc: string | null
    label: string | null
    releaseDate: string | null
}

interface PlaylistTrack extends PlayableTrack {
    name: string
    artists: string[]
    image: string | null
    licensor: string | null
    language: string | null
    isrc: string | null
    label: string | null
    releaseDate: string | null
}

interface ArtistPlaylistReference {
    id: string
    type: string
}

const numberFormatter = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0})
const PLAYLIST_PAGE_SIZE = 8

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

const numberFromUnknown = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    if (typeof value === 'boolean') return value ? 1 : 0
    return null
}

function prettifyPlaylistType(value: string | null | undefined) {
    if (!value) return 'Artist Mix'
    return value
        .split(/[-_]/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ')
}

const recurrenceCopy: Record<string, { label: string; caption: string }> = {
    DAILY: {
        label: 'Daily cadence',
        caption: '24-hour global pulse',
    },
    WEEKLY: {
        label: 'Weekly cadence',
        caption: 'Seven-day global momentum',
    },
}

const prettifyStatus = (value: string | null | undefined) => {
    if (!value) return null
    return value
        .split(/[\s_\-]+/)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
        .join(' ')
}

const deltaColor = (delta: number | null) => {
    if (delta === null) return 'text-white/60'
    if (delta > 0) return 'text-emerald-300'
    if (delta < 0) return 'text-rose-300'
    return 'text-white/60'
}

type ChartSnapshot = {
    date: string
    currentRank: number | null
    previousRank: number | null
    peakRank: number | null
    peakDate: string | null
    appearances: number | null
    consecutive: number | null
    entryStatus: string | null
    entryRank: number | null
    entryDate: string | null
    artistName: string | null
}

type ChartHistoryGroup = {
    recurrence: string
    chartType?: string
    rows: ChartSnapshot[]
    latest: ChartSnapshot
    label: string
    caption: string
}

interface ArtistPageProps {
    artistId: string
}

export default function ArtistPage({artistId}: ArtistPageProps) {

    const [artist, setArtist] = useState<ArtistDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [cityDirectory, setCityDirectory] = useState<Record<number, CityDirectoryEntry>>({})
    const [appleMetadata, setAppleMetadata] = useState<{ genre?: string; url?: string } | null>(null)
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [activePhoto, setActivePhoto] = useState<{ url: string; index: number } | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [activePlaylist, setActivePlaylist] = useState<ArtistPlaylistReference | null>(null)
    const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([])
    const [playlistOrder, setPlaylistOrder] = useState<number[]>([])
    const [playlistLoading, setPlaylistLoading] = useState(false)
    const [playlistError, setPlaylistError] = useState<string | null>(null)
    const [playlistPage, setPlaylistPage] = useState(0)
    const [playlistReloadKey, setPlaylistReloadKey] = useState(0)

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
            setArtist(null)
            setError(null)
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
        const baseTitle = 'World’s Top Artists'

        if (!artist?.n) {
            document.title = baseTitle
            return
        }

        document.title = `${artist.n} | ${baseTitle}`

        return () => {
            document.title = baseTitle
        }
    }, [artist?.n])

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

    useEffect(() => {
        if (!activePlaylist) {
            setPlaylistTracks([])
            setPlaylistOrder([])
            setPlaylistLoading(false)
            setPlaylistError(null)
            setPlaylistPage(0)
            return
        }

        let cancelled = false

        const hydratePlaylist = async () => {
            setPlaylistLoading(true)
            setPlaylistError(null)
            setPlaylistPage(0)
            setPlaylistTracks([])
            setPlaylistOrder([])

            try {
                const response = await fetch(`/data/playlists/${activePlaylist.id}.json`)
                if (!response.ok) {
                    throw new Error('Playlist not found')
                }

                const payload = await response.json()
                const trackIds: string[] = Array.isArray(payload?.tracks)
                    ? payload.tracks.filter((trackId: unknown): trackId is string => typeof trackId === 'string' && trackId.length > 0)
                    : []

                const trackPromises = trackIds.map(async (trackId) => {
                    try {
                        const prefix = trackId.slice(0, 2) || trackId
                        const trackResponse = await fetch(`/data/tracks/${prefix}/${trackId}.json`)
                        if (!trackResponse.ok) return null
                        const trackPayload = await trackResponse.json()

                        const artistNames = Array.isArray(trackPayload?.ar)
                            ? trackPayload.ar.filter((name: unknown): name is string => typeof name === 'string')
                            : []

                        const playlistTrack: PlaylistTrack = {
                            id: typeof trackPayload?.i === 'string' ? trackPayload.i : trackId,
                            name: typeof trackPayload?.n === 'string' ? trackPayload.n : 'Unknown track',
                            artists: artistNames.length ? artistNames : ['Unknown Artist'],
                            image: typeof trackPayload?.img === 'string' ? trackPayload.img : null,
                            preview: typeof trackPayload?.preview === 'string' ? trackPayload.preview : null,
                            canvas: typeof trackPayload?.canvas === 'string' ? trackPayload.canvas : null,
                            licensor: typeof trackPayload?.licensor === 'string' ? trackPayload.licensor : null,
                            language: typeof trackPayload?.language === 'string' ? trackPayload.language : null,
                            isrc: typeof trackPayload?.isrc === 'string' ? trackPayload.isrc : null,
                            label: typeof trackPayload?.label === 'string' ? trackPayload.label : null,
                            releaseDate: typeof trackPayload?.rd === 'string' ? trackPayload.rd : null,
                        }

                        return playlistTrack
                    } catch (playlistTrackError) {
                        console.warn('Failed to load playlist track', trackId, playlistTrackError)
                        return null
                    }
                })

                const hydratedTracks = await Promise.all(trackPromises)

                if (cancelled) return

                const normalizedTracks = hydratedTracks.filter(Boolean) as PlaylistTrack[]
                setPlaylistTracks(normalizedTracks)
                setPlaylistOrder(normalizedTracks.map((_, index) => index))
            } catch (playlistError) {
                if (cancelled) return
                console.error('Failed to hydrate playlist', playlistError)
                setPlaylistTracks([])
                setPlaylistOrder([])
                setPlaylistError('Unable to load featured playlist right now.')
            } finally {
                if (!cancelled) {
                    setPlaylistLoading(false)
                }
            }
        }

        hydratePlaylist()

        return () => {
            cancelled = true
        }
    }, [activePlaylist, playlistReloadKey])

    useEffect(() => {
        setPlaylistPage((current) => {
            if (!playlistOrder.length || !playlistTracks.length) {
                return current === 0 ? current : 0
            }
            const maxPage = Math.max(0, Math.ceil(playlistOrder.length / PLAYLIST_PAGE_SIZE) - 1)
            return Math.min(current, maxPage)
        })
    }, [playlistOrder.length, playlistTracks.length])

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

    const playlistOptions = useMemo(() => {
        if (!artist?.playlists?.rows?.length) return []
        const fields = Array.isArray(artist.playlists.fields) ? artist.playlists.fields : []
        const typeIndex = fields.indexOf('type')
        const idIndex = fields.indexOf('pid')
        if (idIndex === -1) return []
        return artist.playlists.rows
            .map((row) => {
                const playlistId = typeof row[idIndex] === 'string' ? row[idIndex] : null
                if (!playlistId) return null
                const playlistType =
                    typeIndex >= 0 && typeof row[typeIndex] === 'string' ? row[typeIndex] : 'artist-mix'
                return {
                    id: playlistId,
                    type: playlistType,
                }
            })
            .filter(Boolean) as ArtistPlaylistReference[]
    }, [artist?.playlists])

    useEffect(() => {
        if (!playlistOptions.length) {
            setActivePlaylist(null)
            setPlaylistTracks([])
            setPlaylistOrder([])
            setPlaylistError(null)
            setPlaylistPage(0)
            return
        }

        setActivePlaylist((current) => {
            if (current) {
                const stillPresent = playlistOptions.find((option) => option.id === current.id)
                if (stillPresent) {
                    if (stillPresent.type !== current.type) {
                        return stillPresent
                    }
                    return current
                }
            }
            return playlistOptions[0]
        })
    }, [playlistOptions])

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
        return artist.gallery.slice(0, 12).map((id) =>
            id.startsWith('http') ? id : `https://i.scdn.co/image/${id}`
        )
    }, [artist])

    const galleryLayout = useMemo(
        () =>
            galleryImages.map((url, index) => ({
                url,
                span:
                    index === 0
                        ? 'sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2'
                        : index === 3
                            ? 'lg:row-span-2'
                            : '',
            })),
        [galleryImages]
    )

    useEffect(() => {
        if (!activePhoto) return
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setActivePhoto(null)
            } else if (event.key === 'ArrowRight') {
                setActivePhoto((current) => {
                    if (!current) return current
                    const nextIndex = Math.min(current.index + 1, galleryLayout.length - 1)
                    return galleryLayout[nextIndex]
                        ? {url: galleryLayout[nextIndex].url, index: nextIndex}
                        : current
                })
            } else if (event.key === 'ArrowLeft') {
                setActivePhoto((current) => {
                    if (!current) return current
                    const nextIndex = Math.max(current.index - 1, 0)
                    return galleryLayout[nextIndex]
                        ? {url: galleryLayout[nextIndex].url, index: nextIndex}
                        : current
                })
            }
        }

        document.addEventListener('keydown', handleKey)
        const {style} = document.body
        const previousOverflow = style.overflow
        style.overflow = 'hidden'

        return () => {
            document.removeEventListener('keydown', handleKey)
            style.overflow = previousOverflow
        }
    }, [activePhoto, galleryLayout])

    const openPhoto = useCallback(
        (index: number) => {
            const target = galleryLayout[index]
            if (target) {
                setActivePhoto({url: target.url, index})
            }
        },
        [galleryLayout]
    )

    const navigatePhoto = useCallback(
        (direction: -1 | 1) => {
            setActivePhoto((current) => {
                if (!current) return current
                const nextIndex = Math.min(
                    galleryLayout.length - 1,
                    Math.max(0, current.index + direction)
                )
                return galleryLayout[nextIndex]
                    ? {url: galleryLayout[nextIndex].url, index: nextIndex}
                    : current
            })
        },
        [galleryLayout]
    )

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

    const chartHistory = useMemo<ChartHistoryGroup[]>(() => {
        const snapshots = artist?.chartSnapshots
        if (!snapshots || typeof snapshots !== 'object') return []

        const groups: ChartHistoryGroup[] = []

        Object.entries(snapshots).forEach(([recurrence, bucket]) => {
            if (!bucket || typeof bucket !== 'object') return
            const rawRows = Array.isArray(bucket.rows) ? bucket.rows : []

            const rows: ChartSnapshot[] = rawRows
                .map((row) => {
                    if (!row || typeof row !== 'object') return null
                    const date = typeof row.date === 'string' ? row.date : null
                    if (!date) return null
                    return {
                        date,
                        currentRank: numberFromUnknown((row as Record<string, unknown>).currentRank),
                        previousRank: numberFromUnknown((row as Record<string, unknown>).previousRank),
                        peakRank: numberFromUnknown((row as Record<string, unknown>).peakRank),
                        peakDate:
                            typeof (row as Record<string, unknown>).peakDate === 'string'
                                ? ((row as Record<string, unknown>).peakDate as string)
                                : null,
                        appearances: numberFromUnknown((row as Record<string, unknown>).appearancesOnChart),
                        consecutive: numberFromUnknown(
                            (row as Record<string, unknown>).consecutiveAppearancesOnChart
                        ),
                        entryStatus:
                            typeof (row as Record<string, unknown>).entryStatus === 'string'
                                ? ((row as Record<string, unknown>).entryStatus as string)
                                : null,
                        entryRank: numberFromUnknown((row as Record<string, unknown>).entryRank),
                        entryDate:
                            typeof (row as Record<string, unknown>).entryDate === 'string'
                                ? ((row as Record<string, unknown>).entryDate as string)
                                : null,
                        artistName:
                            typeof (row as Record<string, unknown>).artistName === 'string'
                                ? ((row as Record<string, unknown>).artistName as string)
                                : null,
                    }
                })
                .filter(Boolean) as ChartSnapshot[]

            if (!rows.length) return
            rows.sort((a, b) => (a.date < b.date ? 1 : -1))

            const copy = recurrenceCopy[recurrence] ?? {
                label: recurrence,
                caption: 'Global chart cadence',
            }

            groups.push({
                recurrence,
                chartType: typeof bucket.chartType === 'string' ? bucket.chartType : undefined,
                rows,
                latest: rows[0],
                label: copy.label,
                caption: copy.caption,
            })
        })

        return groups.sort((a, b) => a.recurrence.localeCompare(b.recurrence))
    }, [artist?.chartSnapshots])

    const hasChartHistory = chartHistory.length > 0
    const orderedPlaylistTracks =
        playlistOrder.length === playlistTracks.length && playlistOrder.length
            ? playlistOrder.map((index) => playlistTracks[index]).filter(Boolean)
            : playlistTracks
    const playlistPageCount = orderedPlaylistTracks.length
        ? Math.ceil(orderedPlaylistTracks.length / PLAYLIST_PAGE_SIZE)
        : 0
    const safePlaylistPage = playlistPageCount ? Math.min(playlistPage, playlistPageCount - 1) : 0
    const playlistSliceStart = playlistPageCount ? safePlaylistPage * PLAYLIST_PAGE_SIZE : 0
    const visiblePlaylistTracks =
        playlistPageCount === 0
            ? orderedPlaylistTracks.slice(0, PLAYLIST_PAGE_SIZE)
            : orderedPlaylistTracks.slice(playlistSliceStart, playlistSliceStart + PLAYLIST_PAGE_SIZE)
    const playlistRangeStart = playlistPageCount ? playlistSliceStart + 1 : 0
    const playlistRangeEnd =
        playlistPageCount === 0
            ? orderedPlaylistTracks.length
            : Math.min(orderedPlaylistTracks.length, playlistSliceStart + PLAYLIST_PAGE_SIZE)
    const playlistTotalCount = orderedPlaylistTracks.length
    const playlistTitle = activePlaylist ? prettifyPlaylistType(activePlaylist.type) : 'Featured Playlist'
    const playlistHref = activePlaylist ? `https://open.spotify.com/playlist/${activePlaylist.id}` : null
    const playlistHasPagination = playlistPageCount > 1
    const disablePlaylistPrev = safePlaylistPage === 0
    const disablePlaylistNext = playlistPageCount === 0 ? true : safePlaylistPage >= playlistPageCount - 1
    const playlistPageLabel =
        playlistPageCount > 0
            ? `${safePlaylistPage + 1} / ${playlistPageCount}`
            : orderedPlaylistTracks.length
                ? '1 / 1'
                : '—'
    const showPlaylistSection = playlistOptions.length > 0
    const playlistIsEmpty =
        !!activePlaylist && !playlistLoading && !playlistError && orderedPlaylistTracks.length === 0

    const handlePlaylistSelect = useCallback((next: ArtistPlaylistReference) => {
        setActivePlaylist((current) => {
            if (!current) return next
            if (current.id === next.id && current.type === next.type) {
                return {...next}
            }
            return next
        })
    }, [])

    const handlePlaylistPageChange = useCallback(
        (direction: 'prev' | 'next') => {
            if (!playlistPageCount) {
                setPlaylistPage(0)
                return
            }
            setPlaylistPage((current) => {
                if (direction === 'prev') {
                    return Math.max(0, current - 1)
                }
                return Math.min(playlistPageCount - 1, current + 1)
            })
        },
        [playlistPageCount]
    )

    const handlePlaylistShuffle = useCallback(() => {
        if (!playlistTracks.length) {
            setPlaylistOrder([])
            setPlaylistPage(0)
            return
        }

        const indices = Array.from({length: playlistTracks.length}, (_, index) => index)
        for (let i = indices.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[indices[i], indices[j]] = [indices[j], indices[i]]
        }

        setPlaylistOrder(indices)
        setPlaylistPage(0)
    }, [playlistTracks.length])

    const handlePlaylistRetry = useCallback(() => {
        setPlaylistReloadKey((key) => key + 1)
    }, [])

    const handleToggleTrack = (track: PlayableTrack) => {
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
                        <div className="flex items-center gap-3 text-xs text-white/70">
                            <div
                                className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                                <Disc3 className="h-3.5 w-3.5"/>
                                Last sync: {formatDate(artist.today.d)}
                            </div>
                        </div>
                        <Navbar />
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
                                <div className="relative shrink-0 pb-12 md:pb-0">
                                    <div
                                        className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/30 blur-3xl"/>
                                    <img
                                        src={heroImage}
                                        alt={artist.n}
                                        className="relative mx-auto h-60 w-60 rounded-3xl border border-white/20 object-cover shadow-2xl shadow-black/60 md:mx-0 md:h-40 md:w-40"
                                        onError={(event) => {
                                            event.currentTarget.src = '/placeholder-artist.svg'
                                        }}
                                    />
                                    {artist.today.r && (
                                        <Badge
                                            className="absolute bottom-9 left-1/2 -translate-x-1/2 rounded-full md:-bottom-3  border-none bg-emerald-400/90 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-950 shadow-lg shadow-emerald-500/30"
                                        >
                                            #{artist.today.r}
                                        </Badge>
                                    )}
                                </div>
                                <div className="space-y-4 md:mt-0">
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

                    {hasChartHistory && (
                        <section className="mt-10 space-y-6">
                            <div className="space-y-2">
                                <div
                                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-white/60">
                                    <Compass className="h-3.5 w-3.5 text-emerald-300"/>
                                    Global chart footprint
                                </div>
                                <h2 className="text-2xl font-semibold text-white sm:text-3xl">Chart cadence insight</h2>
                                <p className="max-w-2xl text-sm text-white/65 sm:text-base">
                                    Live performance snapshots pulled directly from Spotify&apos;s global artist charts.
                                    Track how rank, peak positions, and entry streaks evolve across daily and weekly
                                    recurrences.
                                </p>
                            </div>
                            <div className="grid gap-5 lg:grid-cols-2">
                                {chartHistory.map((group) => {
                                    const latest = group.latest
                                    const delta =
                                        latest.previousRank !== null && latest.currentRank !== null
                                            ? latest.previousRank - latest.currentRank
                                            : null
                                    const statusLabel = prettifyStatus(latest.entryStatus)

                                    return (
                                        <Card
                                            key={group.recurrence}
                                            className="relative overflow-hidden border-white/10 bg-white/[0.04] backdrop-blur"
                                        >
                                            <div
                                                className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-emerald-400/10 blur-[120px]"/>
                                            <CardHeader className="space-y-5">
                                                <div
                                                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.35em] text-white/45">
                                                            {group.caption}
                                                        </p>
                                                        <div
                                                            className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/60">
                                                            {group.label}
                                                            {group.chartType && (
                                                                <span
                                                                    className="text-white/35">• {group.chartType.replace(/_/g, ' ')}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-white/50">
                                                        {formatDate(latest.date)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-end justify-between gap-4">
                                                    <CardTitle
                                                        className="text-3xl font-semibold text-white sm:text-4xl">
                                                        {latest.currentRank !== null ? `#${latest.currentRank}` : 'Off chart'}
                                                    </CardTitle>
                                                    <div className="text-right text-xs text-white/50">
                                                        <p className={`text-sm font-semibold ${deltaColor(delta)}`}>
                                                            {delta === null || delta === 0
                                                                ? '±0'
                                                                : delta > 0
                                                                    ? `▲${delta}`
                                                                    : delta < 0
                                                                        ? `▼${Math.abs(delta)}`
                                                                        : '·'}
                                                        </p>
                                                        <span>vs previous</span>
                                                    </div>
                                                </div>
                                                <div
                                                    className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                                                    <span
                                                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                        Peak {latest.peakRank ? `#${latest.peakRank}` : '—'}
                                                    </span>
                                                    <span
                                                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                        {formatNumber(latest.appearances ?? null)} total appearances
                                                    </span>
                                                    <span
                                                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                        {formatNumber(latest.consecutive ?? null)} consecutive
                                                    </span>
                                                    {statusLabel && (
                                                        <Badge
                                                            variant="outline"
                                                            className="rounded-full border-emerald-300/40 bg-emerald-400/10 text-[11px] font-medium uppercase tracking-[0.24em] text-emerald-200"
                                                        >
                                                            {statusLabel}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <ScrollArea
                                                    className="h-[270px] rounded-3xl border border-white/10 bg-black/30 pr-3">
                                                    <ul className="divide-y divide-white/10">
                                                        {group.rows.map((row, index) => {
                                                            const rowDelta =
                                                                row.previousRank !== null && row.currentRank !== null
                                                                    ? row.previousRank - row.currentRank
                                                                    : null
                                                            const entryStatus = prettifyStatus(row.entryStatus)
                                                            return (
                                                                <li
                                                                    key={`${row.date}-${index}`}
                                                                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                                                >
                                                                    <div className="mr-6">
                                                                        <p className="text-base font-semibold text-white">
                                                                            {row.currentRank !== null ? `#${row.currentRank}` : '—'}
                                                                        </p>
                                                                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                                                                            {formatDate(row.date)}
                                                                        </p>
                                                                    </div>
                                                                    <div
                                                                        className="flex flex-1 items-center text-xs text-white/55 gap-4 flex-wrap justify-end">
                                                                        <div
                                                                            className="flex items-center gap-4 flex-wrap justify-end">
                                                                            {row.entryRank !== null && (
                                                                                <span className="text-white/45">
                                                                                    Entry #{row.entryRank}
                                                                                </span>
                                                                            )}
                                                                            <span className="text-white/45">
                                                                              Prev {row.previousRank !== null ? `#${row.previousRank}` : '—'}
                                                                            </span>
                                                                            <span
                                                                                className={`inline-flex items-center font-semibold ${deltaColor(rowDelta)}`}
                                                                            >
                                                                                {rowDelta === null || rowDelta === 0
                                                                                    ? '±0'
                                                                                    : rowDelta > 0
                                                                                        ? `▲${rowDelta}`
                                                                                        : rowDelta < 0
                                                                                            ? `▼${Math.abs(rowDelta)}`
                                                                                            : '·'}
                                                                              </span>
                                                                        </div>
                                                                        {entryStatus && (
                                                                            <div className="w-full flex justify-end">
                                                                              <span
                                                                                  className="rounded-full border border-white/10 text-[10px] bg-white/5 px-3 py-1 uppercase tracking-[0.3em] text-white/50">
                                                                                {entryStatus}
                                                                              </span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                </li>
                                                            )
                                                        })}
                                                    </ul>
                                                </ScrollArea>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        </section>
                    )}

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
                                    <ScrollArea className="h-[65vh] pr-3 md:h-[520px]">
                                        <div className="mr-0 flex flex-col gap-3 pb-1 sm:mr-2">
                                            {topTracks.map((track) => {
                                                const isActive = currentTrackId === track.id && isPlaying

                                                return (
                                                    <div
                                                        key={track.id}
                                                        className={[
                                                            "group relative grid grid-cols-1 items-start",
                                                            "sm:grid-cols-[auto,1fr] lg:grid-cols-[auto,1fr,auto]",
                                                            "gap-5 rounded-3xl border border-white/10 bg-white/[0.04]",
                                                            "p-4 sm:p-5 transition-all duration-200",
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
                                                            className="relative h-18 w-18 justify-self-center overflow-hidden rounded-2xl border border-white/10 sm:h-20 sm:w-20 sm:justify-self-start">
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
                                                                    onClick={() => handleToggleTrack(track)}
                                                                    className="absolute inset-0 grid place-items-center bg-black/50 text-emerald-300 cursor-pointer">
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
                                                        <div className="min-w-0 space-y-3 sm:space-y-2">
                                                            <div
                                                                className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
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
                                                                    className="shrink-0 text-left text-xs text-white/60 sm:text-right">
                                                                    <p className="font-semibold text-white/80">
                                                                        {formatNumber(track.playcount)} plays
                                                                    </p>
                                                                    <p>{formatDate(track.releaseDate)}</p>
                                                                </div>
                                                            </div>

                                                            <div
                                                                className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-white/40">
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

                    {showPlaylistSection && (
                        <section className="mt-12">
                            <Card className="border-white/10 bg-black/40">
                                <CardHeader className="flex flex-col gap-4">
                                    <div
                                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.4em] text-white/60">
                                        <Disc3 className="h-3.5 w-3.5 text-emerald-300"/>
                                        Recommended playlist
                                    </div>
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="space-y-3">
                                            <div>
                                                <CardTitle className="text-2xl text-white">{playlistTitle}</CardTitle>
                                            </div>
                                            {playlistHref && (
                                                <Button
                                                    asChild
                                                    variant="secondary"
                                                    className="w-full rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
                                                >
                                                    <a
                                                        href={playlistHref}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2"
                                                    >
                                                        Listen on Spotify
                                                        <ArrowUpRight className="h-4 w-4"/>
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.35em] text-white/60 sm:flex-row sm:flex-wrap sm:items-center">
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/80">
                                                {playlistTotalCount || '—'} curated songs
                                            </span>
                                            {activePlaylist && playlistTotalCount > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={handlePlaylistShuffle}
                                                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1 text-white/80 transition hover:border-emerald-400/50 hover:text-white disabled:opacity-40"
                                                    disabled={playlistLoading}
                                                >
                                                    <Shuffle className="h-3.5 w-3.5"/>
                                                    SHUFFLE
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {playlistOptions.map((option) => {
                                            const isActive = activePlaylist?.id === option.id
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => handlePlaylistSelect(option)}
                                                    disabled={playlistLoading && isActive}
                                                    className={cn(
                                                        'rounded-full border px-4 py-1 text-[11px] uppercase tracking-[0.35em] transition-all',
                                                        isActive
                                                            ? 'border-emerald-400/60 bg-emerald-400/15 text-white shadow-[0_0_25px_rgba(16,185,129,0.15)]'
                                                            : 'border-white/15 bg-white/5 text-white/60 hover:border-white/40 hover:text-white/90'
                                                    )}
                                                >
                                                    {prettifyPlaylistType(option.type)}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {playlistLoading && (
                                        <div
                                            className="flex items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
                                            <Loader2 className="h-4 w-4 animate-spin text-emerald-300"/>
                                            Hydrating {playlistTitle}...
                                        </div>
                                    )}

                                    {!playlistLoading && playlistError && (
                                        <div
                                            className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-rose-500/10 px-5 py-4 text-sm text-white/80">
                                            <p>{playlistError}</p>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                className="self-start rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20"
                                                onClick={handlePlaylistRetry}
                                                disabled={!activePlaylist}
                                            >
                                                Retry playlist
                                            </Button>
                                        </div>
                                    )}

                                    {!playlistLoading && !playlistError && playlistIsEmpty && (
                                        <div
                                            className="rounded-3xl border border-dashed border-white/15 bg-white/5 px-5 py-6 text-center text-sm text-white/60">
                                            This artist mix exists, but its tracks haven't been archived yet.
                                        </div>
                                    )}

                                    {!playlistLoading && !playlistError && !playlistIsEmpty && (
                                        <>
                                            <div className="mr-0 flex flex-col gap-4 pb-1 sm:mr-2">
                                                {visiblePlaylistTracks.map((track) => {
                                                    const isActive = currentTrackId === track.id && isPlaying
                                                    const artistLabel = track.artists.join(', ')

                                                    return (
                                                        <div
                                                            key={track.id}
                                                            className={[
                                                                'group relative flex flex-col gap-6',
                                                                'rounded-3xl border border-white/10 bg-white/[0.04]',
                                                                'p-5 sm:p-6 transition-all duration-200',
                                                                'hover:border-emerald-400/40 hover:bg-emerald-400/[0.06] hover:shadow-lg hover:shadow-emerald-500/5',
                                                                'md:grid md:grid-cols-[auto,1fr] lg:grid-cols-[auto,1fr,auto]',
                                                            ].join(' ')}
                                                        >
                                                            {isActive && track.canvas && (
                                                                <div
                                                                    className="pointer-events-none absolute inset-0 -z-10 opacity-40">
                                                                    <video
                                                                        src={track.canvas}
                                                                        autoPlay
                                                                        loop
                                                                        muted
                                                                        playsInline
                                                                        className="h-full w-full rounded-3xl object-cover"
                                                                    />
                                                                </div>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleTrack(track)}
                                                                disabled={!track.preview}
                                                                aria-label={isActive ? 'Pause preview' : 'Play preview'}
                                                                aria-pressed={isActive}
                                                                className={cn(
                                                                    'relative mx-auto aspect-square w-32 max-w-[180px] overflow-hidden rounded-2xl border border-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 sm:w-36 md:mx-0 md:w-28',
                                                                    !track.preview && 'cursor-not-allowed opacity-50'
                                                                )}
                                                            >
                                                                {track.image ? (
                                                                    <img
                                                                        src={track.image}
                                                                        alt={track.name}
                                                                        className="h-full w-full object-cover"
                                                                        loading="lazy"
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        className="grid h-full w-full place-items-center text-[10px] uppercase tracking-[0.4em] text-white/50">
                                                                        No art
                                                                    </div>
                                                                )}
                                                                <div
                                                                    className={cn(
                                                                        'absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-200',
                                                                        isActive ? 'opacity-100' : 'group-hover:opacity-100'
                                                                    )}
                                                                >
                                                                    <span className="rounded-full bg-black/60 p-2 ring-1 ring-white/10">
                                                                        {isActive ? (
                                                                            <Pause className="h-5 w-5 text-white"/>
                                                                        ) : (
                                                                            <Play className="h-5 w-5 text-white"/>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </button>

                                                            <div className="space-y-3 text-center text-sm text-white md:pr-4 md:text-left">
                                                                <div>
                                                                    <h3 className="text-lg font-semibold text-white">
                                                                        {track.name}
                                                                    </h3>
                                                                    <p className="text-sm text-white/60">
                                                                        {artistLabel}
                                                                    </p>
                                                                </div>
                                                                <div
                                                                    className="flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/50 md:justify-start">
                                                                    {track.label && (
                                                                        <span
                                                                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                                            {track.label}
                                                                        </span>
                                                                    )}
                                                                    {track.language && (
                                                                        <span
                                                                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                                            {track.language.toUpperCase()}
                                                                        </span>
                                                                    )}
                                                                    {track.isrc && (
                                                                        <span
                                                                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                                            {track.isrc}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div
                                                                className="flex w-full flex-col gap-3 text-xs text-white/60 md:col-span-2 md:flex-row md:items-center md:justify-end lg:col-span-1 lg:w-auto">
                                                                <div className="text-center md:text-right">
                                                                    <p className="text-sm font-semibold text-white/80">
                                                                        {formatDate(track.releaseDate)}
                                                                    </p>
                                                                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">
                                                                        {track.licensor ?? track.label ?? 'Independent'}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    variant="secondary"
                                                                    size="icon"
                                                                    className="self-center rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20 md:self-auto"
                                                                    onClick={() => handleToggleTrack(track)}
                                                                    disabled={!track.preview}
                                                                    aria-label={isActive ? 'Pause' : 'Play preview'}
                                                                >
                                                                    {isActive ? <Pause className="h-5 w-5"/> :
                                                                        <Play className="h-5 w-5"/>}
                                                                </Button>
                                                            </div>

                                                            <span
                                                                className="pointer-events-none absolute inset-0 rounded-3xl ring-0 ring-emerald-400/30 transition-all duration-200 group-hover:ring-2"/>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            <div
                                                className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/60">
                                                <span>
                                                    Showing {playlistRangeStart}-{playlistRangeEnd} of {playlistTotalCount || '—'} recommended songs
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="icon"
                                                        className="rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20"
                                                        onClick={() => handlePlaylistPageChange('prev')}
                                                        disabled={disablePlaylistPrev || !playlistHasPagination}
                                                    >
                                                        <ArrowLeft className="h-4 w-4"/>
                                                    </Button>
                                                    <span className="text-white/80">{playlistPageLabel}</span>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="icon"
                                                        className="rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20"
                                                        onClick={() => handlePlaylistPageChange('next')}
                                                        disabled={disablePlaylistNext || !playlistHasPagination}
                                                    >
                                                        <ArrowRight className="h-4 w-4"/>
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </section>
                    )}

                    {cityRows.length > 0 && (
                        <section className="mt-12">
                            <TopCities artistName={artist.n} cityRows={cityRows} directory={cityDirectory}
                                       artistListeners={artist.today.ml}/>
                        </section>
                    )}

                    {galleryLayout.length > 0 && (
                        <section className="mt-12">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div className="space-y-1">
                                    <p className="text-[11px] uppercase tracking-[0.4em] text-white/45">
                                        Visual archive
                                    </p>
                                    <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                                        Gallery
                                    </h2>
                                </div>
                                <span className="text-xs uppercase tracking-[0.35em] text-white/50">
                                    {galleryLayout.length} curated stills
                                </span>
                            </div>

                            <div
                                className="relative mt-6 overflow-hidden rounded-[2.4rem] border border-white/10 bg-white/5 px-4 py-6 shadow-2xl shadow-emerald-500/10 sm:px-6 lg:px-10">
                                <div
                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_60%)]"/>
                                <div
                                    className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 via-black/40 to-transparent"/>

                                <div
                                    className="relative z-10 grid auto-rows-[160px] gap-4 sm:auto-rows-[210px] sm:grid-cols-2 lg:auto-rows-[240px] lg:grid-cols-4">
                                    {galleryLayout.map(({url, span}, index) => (
                                        <figure
                                            key={`${url}-${index}`}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Open photo ${index + 1} of ${artist?.n ?? 'artist'}`}
                                            onClick={() => openPhoto(index)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    openPhoto(index)
                                                }
                                            }}
                                            className={cn(
                                                'group relative cursor-zoom-in overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-lg transition-all duration-500 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-black',
                                                span
                                            )}
                                        >
                                            <img
                                                src={url}
                                                alt={`${artist?.n ?? 'Artist'} gallery ${index + 1}`}
                                                loading="lazy"
                                                className="h-full w-full object-cover transition-transform [transition-duration:1800ms] ease-out group-hover:scale-105"
                                                onError={(event) => {
                                                    event.currentTarget.style.display = 'none'
                                                }}
                                            />
                                            <figcaption
                                                className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between rounded-full bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white/60 backdrop-blur">
                                                <span>{artist?.n ?? 'Artist'}</span>
                                                <span>{index + 1}</span>
                                            </figcaption>
                                        </figure>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {activePhoto && (
                        <div
                            className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-lg sm:flex-row sm:gap-10 sm:px-8">
                            <button
                                type="button"
                                aria-label="Close full-screen photo"
                                className="absolute right-6 top-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/90 transition-colors hover:bg-white/10"
                                onClick={() => setActivePhoto(null)}
                            >
                                <X className="h-5 w-5"/>
                            </button>
                            {activePhoto.index > 0 && (
                                <button
                                    type="button"
                                    aria-label="Previous photo"
                                    className="absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-3 text-white transition hover:bg-white/10 sm:inline-flex"
                                    onClick={() => navigatePhoto(-1)}
                                >
                                    <ArrowLeft className="h-5 w-5"/>
                                </button>
                            )}
                            {activePhoto.index < galleryLayout.length - 1 && (
                                <button
                                    type="button"
                                    aria-label="Next photo"
                                    className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-3 text-white transition hover:bg-white/10 sm:inline-flex"
                                    onClick={() => navigatePhoto(1)}
                                >
                                    <ArrowRight className="h-5 w-5"/>
                                </button>
                            )}
                            <div
                                className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-black/60 shadow-2xl shadow-emerald-500/20">
                                <img
                                    src={activePhoto.url}
                                    alt={`Expanded view ${activePhoto.index + 1}`}
                                    className="h-auto w-full max-h-[78vh] object-contain sm:max-h-[82vh]"
                                />
                                <div
                                    className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-1 text-[11px] uppercase tracking-[0.35em] text-white/60">
                                    <span>{artist?.n ?? 'Artist'}</span>
                                    <span>
                                        {activePhoto.index + 1} / {galleryLayout.length}
                                    </span>
                                </div>
                            </div>
                            <div className="flex w-full max-w-sm items-center gap-3 sm:hidden">
                                <button
                                    type="button"
                                    aria-label="Previous photo"
                                    className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => navigatePhoto(-1)}
                                    disabled={activePhoto.index === 0}
                                >
                                    Prev
                                </button>
                                <button
                                    type="button"
                                    aria-label="Next photo"
                                    className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => navigatePhoto(1)}
                                    disabled={activePhoto.index === galleryLayout.length - 1}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
