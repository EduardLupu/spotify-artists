'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Globe2, Layers, Sparkles, Waves, Minus, Plus, RotateCcw } from 'lucide-react'

interface RawWorldMapArtistRow {
  id: string
  name: string
  listeners: number
  monthlyListeners: number
  imageHash: string | null
}

interface WorldMapArtistRow extends RawWorldMapArtistRow {
  share: number | null
  imageUrl: string | null
}

interface CityDirectoryEntry {
  cid: number
  name: string
  cc: string
  lat: number | null
  lon: number | null
}

interface WorldMapCityRow {
  city: CityDirectoryEntry & { countryName?: string }
  artists: WorldMapArtistRow[]
  totalListeners: number
}

interface WorldMapPayload {
  fields?: string[]
  rows?: any[]
  generated?: string
}

interface CountryLabel {
  iso: string
  name: string
  coordinates: [number, number]
}

const worldGeoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const countriesCentroidUrl =
  'https://cdn.jsdelivr.net/gh/gavinr/world-countries-centroids@v1/dist/countries.geojson'

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const percentFormatter = new Intl.NumberFormat('en', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '—'
  if (value < 1000) return `${Math.round(value)}`
  return compactNumber.format(value)
}

function toSpotifyImage(hash: string | null): string | null {
  if (!hash) return null
  return `https://i.scdn.co/image/${hash}`
}

function mergeArtistRows(existing: WorldMapArtistRow[], incoming: WorldMapArtistRow[]) {
  const map = new Map<string, WorldMapArtistRow>()
  for (const artist of [...existing, ...incoming]) {
    const current = map.get(artist.id)
    if (!current || artist.listeners > current.listeners) {
      map.set(artist.id, artist)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.listeners - a.listeners)
}

function parseWorldMapPayload(payload: WorldMapPayload | null | undefined) {
  if (!payload || !Array.isArray(payload.rows) || !Array.isArray(payload.fields)) {
    return { rows: [] as { cid: number; artists: RawWorldMapArtistRow[] }[], generated: null as string | null }
  }

  const cidIndex = payload.fields.indexOf('cid')
  const artistsIndex = payload.fields.indexOf('artists')
  if (cidIndex === -1 || artistsIndex === -1) {
    return { rows: [], generated: payload.generated ?? null }
  }

  const rows: { cid: number; artists: RawWorldMapArtistRow[] }[] = []
  for (const row of payload.rows) {
    if (!Array.isArray(row)) continue
    const cid = row[cidIndex]
    const artists = row[artistsIndex]
    if (typeof cid !== 'number' || !Array.isArray(artists)) continue

    const parsedArtists: RawWorldMapArtistRow[] = artists
      .map((entry: any) => {
        if (!Array.isArray(entry) || entry.length < 5) return null
        const [id, name, listeners, monthlyListeners, imageHash] = entry
        if (typeof id !== 'string' || typeof name !== 'string') return null
        const listenersNumber = Number(listeners)
        const monthlyNumber = Number(monthlyListeners)
        if (!Number.isFinite(listenersNumber) || listenersNumber <= 0) return null
        return {
          id,
          name,
          listeners: Math.trunc(listenersNumber),
          monthlyListeners: Number.isFinite(monthlyNumber) && monthlyNumber > 0 ? Math.trunc(monthlyNumber) : 0,
          imageHash: typeof imageHash === 'string' && imageHash.length ? imageHash : null,
        }
      })
      .filter((value): value is RawWorldMapArtistRow => Boolean(value))

    if (!parsedArtists.length) continue
    rows.push({ cid, artists: parsedArtists })
  }

  return {
    rows,
    generated: payload.generated ?? null,
  }
}

export function WorldAtlas() {
  const [directory, setDirectory] = useState<Record<number, CityDirectoryEntry>>({})
  const [rawRows, setRawRows] = useState<{ cid: number; artists: RawWorldMapArtistRow[] }[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [activeCityId, setActiveCityId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [countryLabels, setCountryLabels] = useState<CountryLabel[]>([])
  const [countryNames, setCountryNames] = useState<Record<string, string>>({})
  const [countrySignature, setCountrySignature] = useState<string>('')
  const [viewportWidth, setViewportWidth] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [worldResponse, directoryResponse] = await Promise.all([
          fetch('/data/latest/world-map.json', { cache: 'no-store' }),
          fetch('/data/latest/geo-cities.json', { cache: 'no-store' }),
        ])

        if (worldResponse.ok) {
          const payload = (await worldResponse.json()) as WorldMapPayload
          const parsed = parseWorldMapPayload(payload)
          setRawRows(parsed.rows)
          setGeneratedAt(parsed.generated)
        }

        if (directoryResponse.ok) {
          const payload = await directoryResponse.json()
          const entries: Record<number, CityDirectoryEntry> = {}
          if (Array.isArray(payload?.rows)) {
            const fields: string[] = Array.isArray(payload.fields) ? payload.fields : []
            const cidIndex = fields.indexOf('cid')
            const nameIndex = fields.indexOf('name')
            const ccIndex = fields.indexOf('cc')
            const latIndex = fields.indexOf('lat')
            const lonIndex = fields.indexOf('lon')
            for (const row of payload.rows) {
              if (!Array.isArray(row)) continue
              const cid = cidIndex !== -1 ? row[cidIndex] : row[0]
              if (typeof cid !== 'number') continue
              entries[cid] = {
                cid,
                name: typeof row[nameIndex] === 'string' ? row[nameIndex] : '',
                cc: typeof row[ccIndex] === 'string' ? row[ccIndex] : '',
                lat: typeof row[latIndex] === 'number' ? row[latIndex] : null,
                lon: typeof row[lonIndex] === 'number' ? row[lonIndex] : null,
              }
            }
          }
          setDirectory(entries)
        }
      } catch (error) {
        console.error('Failed to load world map data', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  useEffect(() => {
    const updateViewport = () => setViewportWidth(window.innerWidth)
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const dataset = useMemo<WorldMapCityRow[]>(() => {
    if (!rawRows.length) return []
    const cityMap = new Map<number, WorldMapCityRow>()

    for (const row of rawRows) {
      const city = directory[row.cid]
      if (!city || city.lat === null || city.lon === null) continue

      const artists: WorldMapArtistRow[] = row.artists.map((artist) => {
        const share =
          artist.monthlyListeners > 0 ? Math.min(1, Math.max(0, artist.listeners / artist.monthlyListeners)) : null
        return {
          ...artist,
          share,
          imageUrl: toSpotifyImage(artist.imageHash),
        }
      })

      const totalListeners = artists.reduce((acc, artist) => acc + artist.listeners, 0)
      const existing = cityMap.get(row.cid)

      if (!existing) {
        cityMap.set(row.cid, {
          city,
          artists,
          totalListeners,
        })
      } else {
        const mergedArtists = mergeArtistRows(existing.artists, artists)
        const mergedTotalListeners = mergedArtists.reduce((acc, artist) => acc + artist.listeners, 0)
        cityMap.set(row.cid, {
          city: existing.city,
          artists: mergedArtists,
          totalListeners: mergedTotalListeners,
        })
      }
    }

    return Array.from(cityMap.values()).sort((a, b) => b.totalListeners - a.totalListeners)
  }, [rawRows, directory])

  const activeCity = useMemo(() => {
    if (!dataset.length) return null
    if (activeCityId === null) return dataset[0]
    return dataset.find((entry) => entry.city.cid === activeCityId) ?? dataset[0]
  }, [dataset, activeCityId])

  useEffect(() => {
    if (!dataset.length) return
    if (activeCityId === null) {
      setActiveCityId(dataset[0].city.cid)
    }
  }, [dataset, activeCityId])

  useEffect(() => {
    if (!dataset.length) {
      setCountryLabels([])
      setCountryNames({})
      setCountrySignature('')
      return
    }
    const isoList = Array.from(
      new Set(
        dataset
          .map((entry) => entry.city.cc)
          .filter((value): value is string => typeof value === 'string' && value.length === 2)
          .map((value) => value.toUpperCase()),
      ),
    ).sort()

    const signature = isoList.join(',')
    if (!signature || signature === countrySignature) {
      return
    }

    const loadCentroids = async () => {
      try {
        const response = await fetch(countriesCentroidUrl, { cache: 'force-cache' })
        if (!response.ok) return
        const geojson = await response.json()
        const features: any[] = Array.isArray(geojson?.features) ? geojson.features : []
        const labels: CountryLabel[] = []
        const names: Record<string, string> = {}
        const isoSet = new Set(isoList)
        const seenIso = new Set<string>()

        for (const feature of features) {
          const iso = typeof feature?.properties?.ISO === 'string' ? feature.properties.ISO.toUpperCase() : null
          if (!iso || seenIso.has(iso) || !isoSet.has(iso)) continue
          const coords = feature?.geometry?.coordinates
          if (!Array.isArray(coords) || coords.length < 2) continue
          const countryName =
            typeof feature?.properties?.COUNTRY === 'string' ? feature.properties.COUNTRY : feature.properties?.COUNTRYAFF
          if (typeof countryName !== 'string') continue
          labels.push({ iso, name: countryName, coordinates: [coords[0], coords[1]] })
          names[iso] = countryName
          seenIso.add(iso)
        }

        isoList.forEach((iso) => {
          if (!names[iso]) {
            names[iso] = iso
          }
        })

        setCountryLabels(labels)
        setCountryNames(names)
        setCountrySignature(signature)
      } catch (error) {
        console.error('Failed to load country centroids', error)
      }
    }

    loadCentroids()
  }, [dataset, countrySignature])

  const generatedLabel = useMemo(() => {
    if (!generatedAt) return null
    try {
      return new Date(generatedAt).toLocaleString('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return generatedAt
    }
  }, [generatedAt])

  const enrichedDataset = useMemo(() => {
    if (!dataset.length) return []
    return dataset.map((entry) => ({
      ...entry,
      city: {
        ...entry.city,
        countryName: entry.city.cc ? countryNames[entry.city.cc.toUpperCase()] ?? entry.city.cc : undefined,
      },
    }))
  }, [dataset, countryNames])

  const currentCity = useMemo(() => {
    if (!enrichedDataset.length) return null
    if (activeCityId === null) return enrichedDataset[0]
    return enrichedDataset.find((entry) => entry.city.cid === activeCityId) ?? enrichedDataset[0]
  }, [enrichedDataset, activeCityId])

  const isMobile = viewportWidth !== null && viewportWidth < 768
  const isTablet = viewportWidth !== null && viewportWidth >= 768 && viewportWidth < 1280

  const mapDefaults = useMemo(() => {
    const zoom = isMobile ? 1.45 : isTablet ? 1.18 : 1
    const center: [number, number] = isMobile ? [12, 20] : isTablet ? [10, 18] : [15, 15]
    const minZoom = isMobile ? 1 : 0.75
    const maxZoom = isMobile ? 8 : 6
    const heightClass = viewportWidth === null ? 'h-[640px]' : isMobile ? 'h-[520px]' : isTablet ? 'h-[720px]' : 'h-[840px]'
    return {
      zoom,
      center,
      minZoom,
      maxZoom,
      heightClass,
    }
  }, [isMobile, isTablet, viewportWidth])

  const [mapView, setMapView] = useState<{ center: [number, number]; zoom: number }>(() => ({
    center: mapDefaults.center,
    zoom: mapDefaults.zoom,
  }))

  useEffect(() => {
    setMapView({ center: mapDefaults.center, zoom: mapDefaults.zoom })
  }, [mapDefaults])

  const mapHeightClass = mapDefaults.heightClass
  const mapMinZoom = mapDefaults.minZoom
  const mapMaxZoom = mapDefaults.maxZoom

  const adjustZoom = (delta: number) => {
    setMapView((current) => {
      const nextZoom = Math.min(mapMaxZoom, Math.max(mapMinZoom, current.zoom + delta))
      return { ...current, zoom: Number(nextZoom.toFixed(2)) }
    })
  }

  const resetView = () => {
    setMapView({ center: mapDefaults.center, zoom: mapDefaults.zoom })
  }

  const canZoomIn = mapView.zoom < mapMaxZoom - 0.05
  const canZoomOut = mapView.zoom > mapMinZoom + 0.05
  const hasCustomView =
    Math.abs(mapView.zoom - mapDefaults.zoom) > 0.05 ||
    Math.hypot(mapView.center[0] - mapDefaults.center[0], mapView.center[1] - mapDefaults.center[1]) > 0.4

  return (
    <Card className="relative w-full overflow-hidden border-white/10 bg-black/30 backdrop-blur">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-16 h-80 w-80 rounded-full bg-emerald-500/15 blur-[140px]" />
        <div className="absolute right-0 top-1/4 h-[22rem] w-[22rem] rounded-full bg-cyan-500/10 blur-[160px]" />
        <div className="absolute inset-x-32 bottom-[-220px] h-[28rem] rounded-full bg-emerald-500/5 blur-[200px]" />
      </div>

      <CardHeader className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <Badge className="inline-flex items-center gap-2 rounded-full border-white/10 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/60">
            <Globe2 className="h-3.5 w-3.5 text-emerald-300" />
            Atlas
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
          <Badge variant="muted" className="rounded-full border-white/10 bg-white/10 text-[11px] text-white/70">
            {enrichedDataset.length} cities mapped
          </Badge>
          <Badge variant="muted" className="rounded-full border-white/10 bg-white/10 text-[11px] text-white/70">
            {rawRows.reduce((acc, row) => acc + row.artists.length, 0)} artist-city pairs
          </Badge>
          {generatedLabel && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
              <Waves className="h-3.5 w-3.5 text-emerald-300" />
              Updated {generatedLabel}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        {loading ? (
          <div className="flex h-[620px] items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-sm text-white/50">
            Mapping the globe…
          </div>
        ) : enrichedDataset.length === 0 ? (
          <div className="flex h-[620px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-white/60">
            No city data available. Run the world map aggregation to populate this view.
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1.35fr)_minmax(0,340px)] lg:items-stretch lg:gap-8 xl:grid-cols-[minmax(0,460px)_minmax(0,1.4fr)_minmax(0,380px)] 2xl:grid-cols-[minmax(0,480px)_minmax(0,1.5fr)_minmax(0,420px)]">
            <div className="order-2 flex flex-col gap-6 lg:order-1 lg:h-full">
              <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70 shadow-lg shadow-emerald-500/10 backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-white/55">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                    Focus city
                  </span>
                  {currentCity && (
                    <Badge className="rounded-full border-white/10 bg-emerald-400/10 text-[11px] font-medium text-emerald-200">
                      {formatNumber(currentCity.totalListeners)} listeners
                    </Badge>
                  )}
                </div>

                {currentCity ? (
                  <div className="mt-6 space-y-5">
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-white md:text-xl">{currentCity.city.name}</p>
                      <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
                        {currentCity.city.countryName ?? currentCity.city.cc}
                      </p>
                    </div>
                    <div className="flex flex-col rounded-2xl border border-white/10 bg-black/50 p-4 shadow-inner shadow-black/40">
                      <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Artist breakdown</p>
                      <ScrollArea className="mt-4 h-[240px] pr-2 sm:h-[260px] lg:h-[320px] xl:h-[360px] 2xl:h-[600px]">
                        <div className="divide-y divide-white/5">
                          {currentCity.artists.map((artist, index) => (
                            <div
                              key={artist.id}
                              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                            >
                              <div className="flex flex-1 items-center gap-3">
                                <Avatar className="h-12 w-12 border rounded-2xl border-white/10 bg-black/40">
                                  <AvatarImage
                                    src={artist.imageUrl ?? undefined}
                                    alt={artist.name}
                                    onError={(event) => {
                                      event.currentTarget.src = '/placeholder-artist.svg'
                                    }}
                                  />
                                  <AvatarFallback>{artist.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <Link
                                    href={`/artist?id=${artist.id}`}
                                    className="text-sm font-semibold text-white transition-colors hover:text-emerald-300"
                                  >
                                    {artist.name}
                                  </Link>
                                  <p className="truncate text-[11px] text-white/50">
                                    {formatNumber(artist.listeners)} listeners ·{' '}
                                    {artist.share !== null ? percentFormatter.format(artist.share) : '—'} of monthly
                                  </p>
                                </div>
                              </div>
                              <span className="text-[11px] text-white/60">
                                {formatNumber(artist.monthlyListeners)} monthly
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/50">Select a city to see its listener distribution.</p>
                )}
              </div>
            </div>

            <div className="order-1 lg:order-2 lg:h-full">
              <div
                className={cn(
                  'relative h-full overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-xl shadow-emerald-500/10',
                  mapHeightClass,
                )}
              >
                <div className="absolute right-5 top-5 z-20 flex flex-col gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white hover:bg-emerald-400/20"
                    onClick={() => adjustZoom(mapView.zoom >= 4 ? 0.8 : 0.45)}
                    disabled={!canZoomIn}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white hover:bg-emerald-400/20"
                    onClick={() => adjustZoom(mapView.zoom >= 4 ? -0.8 : -0.45)}
                    disabled={!canZoomOut}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white hover:bg-emerald-400/20"
                    onClick={resetView}
                    disabled={!hasCustomView}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="pointer-events-none absolute inset-0 opacity-40">
                  <div className="absolute -left-24 top-12 h-60 w-60 rounded-full bg-emerald-500/30 blur-3xl" />
                  <div className="absolute bottom-10 right-16 h-64 w-64 rounded-full bg-cyan-500/30 blur-[140px]" />
                </div>
                <div className="relative z-10 h-full w-full">
                  <TooltipProvider>
                    <ComposableMap
                      projectionConfig={{ scale: isMobile ? 240 : isTablet ? 230 : 220 }}
                      width={1440}
                      height={760}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <ZoomableGroup
                        center={mapView.center}
                        zoom={mapView.zoom}
                        minZoom={mapMinZoom}
                        maxZoom={mapMaxZoom}
                        onMoveEnd={(position) => {
                          setMapView({ center: position.coordinates as [number, number], zoom: position.zoom })
                        }}
                      >
                        <Geographies geography={worldGeoUrl}>
                          {({ geographies }) =>
                            geographies.map((geo) => (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                fill="#0f1117"
                                stroke="#202432"
                                style={{
                                  default: { outline: 'none' },
                                  hover: { outline: 'none' },
                                  pressed: { outline: 'none' },
                                }}
                              />
                            ))
                          }
                        </Geographies>

                        {countryLabels.map((country) => (
                          <Marker key={country.iso} coordinates={country.coordinates}>
                            <text
                              textAnchor="middle"
                              style={{
                                fontSize: '11px',
                                fill: 'rgba(255,255,255,0.55)',
                                letterSpacing: '0.22em',
                                textTransform: 'uppercase',
                              }}
                            >
                              {country.name}
                            </text>
                          </Marker>
                        ))}

                        {enrichedDataset.map((entry) => {
                          const isActive = currentCity?.city.cid === entry.city.cid
                          const radius = Math.min(7, Math.max(2.2, Math.log(entry.totalListeners) * 0.32))
                          return (
                            <Tooltip key={entry.city.cid}>
                              <TooltipTrigger asChild>
                                <Marker coordinates={[entry.city.lon as number, entry.city.lat as number]}>
                                  <g
                                    className="cursor-pointer"
                                    onMouseEnter={() => setActiveCityId(entry.city.cid)}
                                    onClick={() => setActiveCityId(entry.city.cid)}
                                  >
                                    <circle
                                      r={radius}
                                      fill={isActive ? 'rgba(16,185,129,0.55)' : 'rgba(16,185,129,0.32)'}
                                      stroke={isActive ? 'rgba(52,211,153,0.85)' : 'rgba(52,211,153,0.45)'}
                                      strokeWidth={isActive ? 1.8 : 1.1}
                                    />
                                    {isActive && (
                                      <circle r={radius + 3.5} fill="rgba(52,211,153,0.12)" stroke="none" />
                                    )}
                                    <circle
                                      r={radius / 2.4}
                                      fill={isActive ? 'rgba(13,148,136,0.9)' : 'rgba(13,148,136,0.75)'}
                                    />
                                  </g>
                                </Marker>
                              </TooltipTrigger>
                              <TooltipContent className="border border-white/10 bg-black/80 text-white/80 backdrop-blur">
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-white">
                                    {entry.city.name}, {entry.city.countryName ?? entry.city.cc}
                                  </p>
                                  <p className="text-[11px] text-white/60">
                                    {formatNumber(entry.totalListeners)} total listeners
                                  </p>
                                  <div className="space-y-1 pt-1">
                                    {entry.artists.slice(0, 5).map((artist, index) => (
                                      <div key={artist.id} className="flex items-center justify-between text-[11px] text-white/70">
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-white/40">{index + 1}.</span> {artist.name}
                                        </span>
                                        <span>
                                          {formatNumber(artist.listeners)} ·{' '}
                                          {artist.share !== null ? percentFormatter.format(artist.share) : '—'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </ZoomableGroup>
                    </ComposableMap>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            <div className="order-3 lg:order-3 lg:h-full">
              <div className={cn('flex h-full flex-col rounded-3xl border border-white/10 bg-black/40 p-4 text-sm text-white/70 shadow-lg shadow-black/30 backdrop-blur', mapHeightClass)}>
                <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/45">
                  <span>All cities</span>
                  <span className="inline-flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-emerald-300" />
                    Ranked
                  </span>
                </div>
                <ScrollArea className="flex-1 pr-3">
                  <div className="space-y-2 pr-1">
                    {enrichedDataset.map((entry) => {
                      const isActive = currentCity?.city.cid === entry.city.cid
                      return (
                        <button
                          key={entry.city.cid}
                          type="button"
                          onClick={() => setActiveCityId(entry.city.cid)}
                          onMouseEnter={() => setActiveCityId(entry.city.cid)}
                          className={cn(
                            'w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70',
                            isActive
                              ? 'border-emerald-400/60 bg-emerald-400/10 text-white shadow-lg shadow-emerald-500/10'
                              : 'border-white/10 bg-white/5 text-white/80 hover:border-emerald-400/30 hover:bg-emerald-400/5',
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{entry.city.name}</p>
                              <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">
                                {entry.city.countryName ?? entry.city.cc}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-white">{formatNumber(entry.totalListeners)}</p>
                              <p className="text-[11px] text-white/50">Lead · {entry.artists[0]?.name ?? '—'}</p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
