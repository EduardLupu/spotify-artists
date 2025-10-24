'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Flame, MapPin } from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'

interface CityRow {
  cid: number
  listeners: number
}

interface CityDirectoryEntry {
  cid: number
  name: string
  cc: string
  lat: number
  lon: number
}

const geoUrl =
  'https://cdn.jsdelivr.net/gh/gavinr/world-countries-centroids@v1/dist/world-countries.json'

const numberFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function formatNumber(value: number) {
  if (value < 1000) return `${value}`
  return numberFormatter.format(value)
}

interface TopCitiesProps {
  artistName: string
  cityRows: CityRow[]
  directory: Record<number, CityDirectoryEntry>
}

export function TopCities({ artistName, cityRows, directory }: TopCitiesProps) {
  const dataset = useMemo(() => {
    if (!cityRows?.length) return []
    const total = cityRows.reduce((acc, row) => acc + (row.listeners || 0), 0) || 1
    return cityRows
      .map((row) => {
        const city = directory[row.cid]
        if (!city) return null
        return {
          ...city,
          listeners: row.listeners,
          share: row.listeners / total,
        }
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((a, b) => b.listeners - a.listeners)
  }, [cityRows, directory])

  const [activeCity, setActiveCity] = useState<(typeof dataset)[number] | null>(null)

  useEffect(() => {
    setActiveCity(dataset[0] ?? null)
  }, [dataset])

  if (!dataset.length) {
    return null
  }

  const crownCity = dataset[0]

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
      <Card className="border-white/10 bg-white/5 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-white">City Heatmap</CardTitle>
          <CardDescription className="text-xs text-white/60">
            {artistName}&rsquo;s most engaged listeners by city with share of monthly audience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-400/10 to-cyan-400/10 p-4 text-sm text-white/80">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/60">
                <Flame className="h-3.5 w-3.5 text-emerald-300" />
                Hotspot
              </span>
              <Badge variant="muted" className="rounded-full border-white/10 bg-white/10 text-[11px] text-white/80">
                {(crownCity.share * 100).toFixed(1)}% audience
              </Badge>
            </div>
            <p className="mt-3 text-base font-semibold text-white">
              {crownCity.name}, {crownCity.cc}
            </p>
            <p className="text-xs text-white/60">{formatNumber(crownCity.listeners)} listeners</p>
          </div>

          <ScrollArea className="h-[320px] pr-3">
            <div className="space-y-3">
              {dataset.map((city) => (
                <button
                  key={city.cid}
                  type="button"
                  onMouseEnter={() => setActiveCity(city)}
                  onFocus={() => setActiveCity(city)}
                  onClick={() => setActiveCity(city)}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200',
                    activeCity?.cid === city.cid
                      ? 'border-emerald-400/50 bg-emerald-400/10 shadow-lg shadow-emerald-500/10'
                      : 'border-white/10 bg-white/5 hover:border-emerald-400/30 hover:bg-emerald-400/5'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{city.name}</p>
                      <p className="text-xs uppercase tracking-widest text-white/50">{city.cc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{formatNumber(city.listeners)}</p>
                      <p className="text-xs text-white/50">{(city.share * 100).toFixed(1)}% share</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-white/10 bg-black/40">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -left-10 top-10 h-48 w-48 rounded-full bg-emerald-500/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-cyan-500/30 blur-[120px]" />
        </div>
        <CardHeader className="z-10 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <MapPin className="h-4 w-4 text-emerald-300" />
            Listener geography
          </CardTitle>
          <CardDescription className="text-xs text-white/60">
            Hover markers to explore listener counts. Sized proportionally to audience share.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          <TooltipProvider>
            <ComposableMap
              projectionConfig={{ scale: 150 }}
              width={800}
              height={400}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup center={[0, 20]} zoom={1}>
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#101010"
                        stroke="#1f1f1f"
                        style={{
                          default: { outline: 'none' },
                          hover: { outline: 'none' },
                          pressed: { outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>
                {dataset.map((city) => {
                  const radius = Math.max(4, Math.log(city.listeners) * 0.9)
                  const isActive = city.cid === activeCity?.cid
                  return (
                    <Tooltip key={city.cid}>
                      <TooltipTrigger asChild>
                        <Marker coordinates={[city.lon, city.lat]}>
                          <g className="cursor-pointer">
                            <circle
                              r={radius}
                              fill={isActive ? 'rgba(16, 185, 129, 0.55)' : 'rgba(16, 185, 129, 0.28)'}
                              stroke={isActive ? '#34d399' : 'rgba(52, 211, 153, 0.4)'}
                              strokeWidth={isActive ? 2.3 : 1.5}
                              onMouseEnter={() => setActiveCity(city)}
                            />
                            {isActive && (
                              <circle
                                r={radius + 6}
                                fill="none"
                                stroke="rgba(34,197,94,0.35)"
                                strokeWidth={1.2}
                              />
                            )}
                          </g>
                        </Marker>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white">
                            {city.name}, {city.cc}
                          </span>
                          <span className="text-[11px] text-white/70">
                            {formatNumber(city.listeners)} listeners ({(city.share * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </ZoomableGroup>
            </ComposableMap>
          </TooltipProvider>

          {activeCity && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/50">Focused city</p>
                  <p className="text-lg font-semibold text-white">
                    {activeCity.name}, {activeCity.cc}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-white/50">
                    Listeners
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {formatNumber(activeCity.listeners)}
                  </p>
                  <p className="text-xs text-white/50">
                    {(activeCity.share * 100).toFixed(1)}% of monthly listeners
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
