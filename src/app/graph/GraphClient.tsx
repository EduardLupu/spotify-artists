'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import * as THREE from 'three'
import type { ForceGraphMethods } from 'react-force-graph-3d'
import { ArrowLeft, Atom, ExternalLink, Loader2, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false })

type RawArtistNode = { i: string; n: string; p: string }
type ArtistNode = { id: string; name: string; imageHash: string }
type ArtistLink = { source: string; target: string }
type RawArtistGraph = { nodes: RawArtistNode[]; links: ArtistLink[] }
type ArtistGraph = { nodes: ArtistNode[]; links: ArtistLink[] }
type AdjacencyMap = Map<string, Set<string>>

const IMAGE_BASE_URL = 'https://i.scdn.co/image/'
const IMAGE_PLACEHOLDER = '/placeholder-artist.svg'

function buildAdjacency(links: ArtistLink[]): AdjacencyMap {
  const map: AdjacencyMap = new Map()
  const add = (from: string, to: string) => {
    if (!map.has(from)) map.set(from, new Set())
    map.get(from)!.add(to)
  }
  links.forEach((link) => {
    add(link.source, link.target)
    add(link.target, link.source)
  })
  return map
}

function useArtistGraph() {
  const [graph, setGraph] = useState<ArtistGraph | null>(null)
  const [adjacency, setAdjacency] = useState<AdjacencyMap>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadGraph = async () => {
      try {
        const response = await fetch('/data/latest/artist-graph.json', { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load artist graph')
        const raw = (await response.json()) as RawArtistGraph
        const normalized: ArtistGraph = {
          nodes: raw.nodes.map((node) => ({
            id: node.i,
            name: node.n,
            imageHash: typeof node.p === 'string' ? node.p : '',
          })),
          links: raw.links.map((link) => ({
            source: String(link.source),
            target: String(link.target),
          })),
        }
        setGraph(normalized)
        setAdjacency(buildAdjacency(normalized.links))
      } catch (error) {
        console.error('Failed to fetch artist graph', error)
        setGraph(null)
        setAdjacency(new Map())
      } finally {
        setLoading(false)
      }
    }
    loadGraph()
  }, [])

  return { graph, adjacency, loading }
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-white/70">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        Mapping constellation…
      </div>
    </div>
  )
}

function createPlaceholderMaterial(): THREE.SpriteMaterial {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.48)
    gradient.addColorStop(0, 'rgba(59,214,155,0.9)')
    gradient.addColorStop(1, 'rgba(29,185,84,0.12)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  })
}

type GraphCanvasProps = {
  graph: ArtistGraph
  adjacency: AdjacencyMap
  selectedId: string | null
  onSelect: (id: string, event: MouseEvent | undefined) => void
}

function GraphCanvas({ graph, adjacency, selectedId, onSelect }: GraphCanvasProps) {
  const fgRef = useRef<ForceGraphMethods | null>(null)
  const labels = useMemo(() => {
    const map = new Map<string, string>()
    graph.nodes.forEach((node) => map.set(node.id, node.name))
    return map
  }, [graph.nodes])

  const textureLoader = useMemo(() => {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    return loader
  }, [])

  const placeholderMaterial = useMemo(() => createPlaceholderMaterial(), [])
  const materialCache = useMemo(() => new Map<string, THREE.SpriteMaterial>(), [])

  const getMaterial = useCallback(
    (hash: string) => {
      const key = hash && hash.length > 0 ? hash : '__placeholder__'
      const cached = materialCache.get(key)
      if (cached) return cached
      if (!hash) {
        materialCache.set(key, placeholderMaterial)
        return placeholderMaterial
      }
      const texture = textureLoader.load(`${IMAGE_BASE_URL}${hash}`, (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace
        loaded.minFilter = THREE.LinearFilter
        loaded.magFilter = THREE.LinearFilter
      })
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
      materialCache.set(key, material)
      return material
    },
    [materialCache, placeholderMaterial, textureLoader]
  )

  const chargeStrength = selectedId ? -155 : -100
  const linkDistance = selectedId ? 120 : 85

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const chargeForce = fg.d3Force('charge')
    if (chargeForce && typeof (chargeForce as any).strength === 'function') {
      ;(chargeForce as any).strength(chargeStrength)
    }
    const linkForce = fg.d3Force('link')
    if (linkForce && typeof (linkForce as any).distance === 'function') {
      ;(linkForce as any).distance(linkDistance)
    }
    fg.d3ReheatSimulation()
  }, [adjacency, chargeStrength, linkDistance, graph.nodes.length])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const duration = selectedId ? 900 : 600
    if (selectedId) {
      const focusFilter = (node: any) => {
        const id = (node as ArtistNode).id
        if (!id) return false
        if (id === selectedId) return true
        return adjacency.get(selectedId)?.has(id) ?? false
      }
      fg.zoomToFit(duration, 50, focusFilter)
      const controls: any = fg.controls?.()
      const target = controls?.target ?? { x: 0, y: 0, z: 0 }
      fg.cameraPosition(
        { x: target.x, y: target.y, z: 360 },
        { x: target.x, y: target.y, z: target.z },
        duration
      )
      return
    }
    fg.zoomToFit(duration, 80)
  }, [adjacency, graph.nodes, selectedId])

  return (
    <ForceGraph3D
      ref={fgRef as unknown as MutableRefObject<ForceGraphMethods>}
      graphData={graph}
      backgroundColor="#020202"
      nodeThreeObject={(node) => {
        const artist = node as ArtistNode
        const isSelected = selectedId === artist.id
        const sprite = new THREE.Sprite(getMaterial(artist.imageHash))
        sprite.scale.set(isSelected ? 28 : 22, isSelected ? 28 : 22, 1)

        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            color: isSelected ? 0x5effd2 : 0x1db954,
            transparent: true,
            opacity: isSelected ? 0.3 : 0.16,
            depthWrite: false,
          })
        )
        halo.scale.set(isSelected ? 38 : 28, isSelected ? 38 : 28, 1)

        const group = new THREE.Group()
        group.add(sprite)
        group.add(halo)
        return group
      }}
      nodeLabel={(node) => labels.get((node as ArtistNode).id) ?? ''}
      nodeResolution={32}
      linkColor={() => 'rgba(255,255,255,0.12)'}
      linkOpacity={0.35}
      linkWidth={0.25}
      linkDirectionalParticles={0.25}
      linkDirectionalParticleSpeed={0.002}
      linkDirectionalParticleColor={() => 'rgba(29,185,84,0.4)'}
      nodeVal={1}
      enableNodeDrag={false}
      warmupTicks={200}
      cooldownTicks={420}
      showNavInfo={false}
      onNodeClick={(node, event) => {
        const artist = node as ArtistNode
        onSelect(artist.id, event as MouseEvent | undefined)
      }}
    />
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return 'AR'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export default function GraphClient() {
  const { graph, adjacency, loading } = useArtistGraph()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nodeIndex = useMemo(() => {
    if (!graph) return new Map<string, ArtistNode>()
    const map = new Map<string, ArtistNode>()
    graph.nodes.forEach((node) => map.set(node.id, node))
    return map
  }, [graph])

  const degreeMap = useMemo(() => {
    const map = new Map<string, number>()
    adjacency.forEach((neighbors, id) => map.set(id, neighbors.size))
    return map
  }, [adjacency])

  const focusSet = useMemo(() => {
    if (!graph || !selectedId) return null
    const neighbors = adjacency.get(selectedId)
    const set = new Set<string>()
    set.add(selectedId)
    neighbors?.forEach((id) => set.add(id))
    return set
  }, [adjacency, graph, selectedId])

  const displayGraph = useMemo<ArtistGraph | null>(() => {
    if (!graph) return null
    if (!selectedId || !focusSet) {
      return {
        nodes: graph.nodes.map((node) => ({ ...node })),
        links: graph.links.map((link) => ({ source: link.source, target: link.target })),
      }
    }
    const nodes = graph.nodes.filter((node) => focusSet.has(node.id)).map((node) => ({ ...node }))
    const links = graph.links
      .filter((link) => focusSet.has(link.source) && focusSet.has(link.target))
      .map((link) => ({ source: link.source, target: link.target }))
    return { nodes, links }
  }, [focusSet, graph, selectedId])

  const statsGraph = displayGraph ?? graph
  const selectedArtist = selectedId ? nodeIndex.get(selectedId) ?? null : null

  const neighborNodes = useMemo(() => {
    if (!graph || !selectedId) return []
    const neighbors = adjacency.get(selectedId)
    if (!neighbors || neighbors.size === 0) return []
    const list: ArtistNode[] = []
    neighbors.forEach((neighborId) => {
      const node = nodeIndex.get(neighborId)
      if (node) list.push(node)
    })
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [adjacency, graph, nodeIndex, selectedId])

  const handleSelect = useCallback(
    (id: string, event?: MouseEvent) => {
      if (event && (event.metaKey || event.ctrlKey)) {
        window.open(`/artist/${id}`, '_blank', 'noopener,noreferrer')
        return
      }
      setSelectedId((previous) => (previous === id ? previous : id))
    },
    []
  )

  const resetSelection = useCallback(() => setSelectedId(null), [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#010101] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-16 h-[26rem] w-[26rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 bottom-1/3 h-[32rem] w-[32rem] rounded-full bg-cyan-500/10 blur-[220px]" />
        <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-[1880px] flex-col gap-8 px-6 pb-16 pt-12 md:pt-16">
        <header className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.32em] text-white/60">
              <Atom className="h-3.5 w-3.5 text-emerald-300" />
              Artist constellation
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Top 500 Relationship Graph
              </h1>
              <p className="max-w-2xl text-sm text-white/65 sm:text-base">
                Click a sprite to isolate its orbit. The right column lists every directly related artist so you can
                traverse the network with intent.
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="secondary"
            className="group inline-flex h-11 w-fit items-center justify-center gap-2 rounded-full border-white/10 bg-white/10 px-6 text-white hover:bg-white/20"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to dashboard
            </Link>
          </Button>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,4.4fr)_minmax(460px,1fr)] 2xl:grid-cols-[minmax(0,4.6fr)_minmax(520px,1fr)]">
          <div className="relative min-h-[64vh] overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-3 backdrop-blur">
            {selectedId && (
              <>
                <div className="absolute left-5 top-5 z-10 flex flex-wrap items-center gap-3 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/50">
                  Focus
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold tracking-[0.28em] text-emerald-200">
                    {selectedArtist?.name ?? selectedId}
                  </span>
                </div>
                <div className="absolute right-5 top-5 z-10">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full border border-white/10 bg-black/55 text-white hover:bg-white/15"
                    onClick={resetSelection}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset view
                  </Button>
                </div>
              </>
            )}
            <div className="h-full w-full">
              {loading && <LoadingState />}
              {!loading && displayGraph && (
                <Suspense fallback={<LoadingState />}>
                  <GraphCanvas
                    graph={displayGraph}
                    adjacency={adjacency}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                  />
                </Suspense>
              )}
              {!loading && !displayGraph && (
                <div className="flex h-full items-center justify-center text-sm text-white/55">
                  Unable to load artist graph. Please try again later.
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-white">Network overview</CardTitle>
                <CardDescription className="text-xs text-white/55">
                  {selectedId
                    ? 'Viewing the direct orbit of the selected artist.'
                    : 'Full constellation of the Top 500 network.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-white/70">
                <div className="flex items-center justify-between">
                  <span>Nodes in view</span>
                  <span className="font-medium text-white/85">{statsGraph?.nodes.length ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Connections</span>
                  <span className="font-medium text-white/85">{statsGraph?.links.length ?? '—'}</span>
                </div>
                <Separator className="border-white/10" />
                <p className="text-[11px] leading-relaxed text-white/45">
                  Hold <span className="text-white/70">⌘</span>/<span className="text-white/70">Ctrl</span> while clicking
                  to open an artist in a new tab. Use focus mode to inspect clusters with clarity.
                </p>
              </CardContent>
            </Card>

            <Card className="flex-1 border-white/10 bg-black/35 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-white">
                  {selectedArtist ? selectedArtist.name : 'Choose an artist'}
                </CardTitle>
                <CardDescription className="text-xs text-white/55">
                  {selectedArtist
                    ? 'Directly related artists inside the Top 500.'
                    : 'Select a node to surface its immediate constellation.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedArtist ? (
                  neighborNodes.length > 0 ? (
                    <ScrollArea className="h-[520px] pr-2">
                      <ul className="space-y-3">
                        {neighborNodes.map((neighbor) => (
                          <li
                            key={neighbor.id}
                            className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm transition hover:border-emerald-400/30 hover:bg-emerald-400/10"
                          >
                            <button
                              type="button"
                              className="flex flex-1 items-center gap-3 text-left"
                              onClick={() => setSelectedId(neighbor.id)}
                            >
                              <Avatar className="h-10 w-10 border border-white/10">
                                <AvatarImage
                                  src={neighbor.imageHash ? `${IMAGE_BASE_URL}${neighbor.imageHash}` : IMAGE_PLACEHOLDER}
                                  alt={neighbor.name}
                                  onError={(event) => {
                                    event.currentTarget.src = IMAGE_PLACEHOLDER
                                  }}
                                />
                                <AvatarFallback>{initials(neighbor.name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-white">{neighbor.name}</span>
                                <span className="text-xs text-white/45">
                                  {degreeMap.get(neighbor.id) ?? 0} total connections
                                </span>
                              </div>
                            </button>
                            <Link
                              href={`/artist/${neighbor.id}`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-emerald-400/50 hover:text-emerald-200"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  ) : (
                    <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/30 px-6 text-center text-sm text-white/50">
                      No related artists found inside the Top 500.
                    </div>
                  )
                ) : (
                  <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/30 px-6 text-center text-sm text-white/55">
                    Click a node in the constellation to reveal every directly connected artist with quick links.
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </section>
      </main>
    </div>
  )
}
