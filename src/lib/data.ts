export interface Top500Payload {
  v: number
  date: string
  fields: string[]
  rows: any[][]
}

export interface FormerPayload {
  v: number
  date: string
  fields: string[]
  rows: any[][]
}

export interface MetaPayload {
  generatedAt: string
  totalArtists: number
}

export async function getTop500Payload(): Promise<Top500Payload> {
  const module = await import('@/../public/data/latest/top500.json', {
    assert: { type: 'json' },
  })
  return module.default as Top500Payload
}

export async function getFormerPayload(): Promise<FormerPayload> {
  const module = await import('@/../public/data/latest/former500.json', {
    assert: { type: 'json' },
  })
  return module.default as FormerPayload
}

export async function getMetaPayload(): Promise<MetaPayload | null> {
  try {
    const module = await import('@/../public/data/latest/meta.json', {
      assert: { type: 'json' },
    })
    return module.default as unknown as MetaPayload
  } catch (error) {
    console.warn('meta.json missing', error)
    return null
  }
}

export function mapTop500Rows(payload: Top500Payload) {
  const fieldIndex = new Map(payload.fields.map((field, index) => [field, index]))

  const read = (row: any[], field: string) => row[fieldIndex.get(field)!]

  const get = (row: any[], field: string, fallback = 0) => {
    const value = read(row, field)
    return typeof value === 'number' ? value : fallback
  }

  return payload.rows.map((row) => ({
    id: read(row, 'i') as string,
    name: read(row, 'n') as string,
    imageHash: read(row, 'p') as string,
    rank: get(row, 'r'),
    monthlyListeners: get(row, 'ml'),
    followers: get(row, 'f'),
    delta: get(row, 'dr', 0),
    g1: get(row, 'g1'),
    g7: get(row, 'g7'),
    g30: get(row, 'g30'),
    freshness: get(row, 'fs'),
    momentum: get(row, 'ms'),
    bestRank: (() => {
      const value = read(row, 'br')
      return typeof value === 'number' ? value : null
    })(),
    streak: get(row, 'st'),
  }))
}

export type FormerArtist = {
  id: string
  name: string
  imageHash: string | null
  monthlyListeners: number | null
  followers: number | null
  bestRank: number | null
  lastTop500: string | null
  daysSince: number | null
}

export function mapFormerRows(payload: FormerPayload): FormerArtist[] {
  const fieldIndex = new Map(payload.fields.map((field, index) => [field, index]))

  const read = (row: any[], field: string) => {
    const index = fieldIndex.get(field)
    if (index === undefined) {
      return undefined
    }
    return row[index]
  }

  const getNumber = (row: any[], field: string): number | null => {
    const value = read(row, field)
    return typeof value === 'number' ? value : null
  }

  return payload.rows.map((row) => {
    const image = read(row, 'p')
    const lastTop500 = read(row, 'lf')
    return {
      id: (read(row, 'i') as string) ?? '',
      name: (read(row, 'n') as string) ?? 'Unknown Artist',
      imageHash: typeof image === 'string' && image.length > 0 ? image : null,
      monthlyListeners: getNumber(row, 'ml'),
      followers: getNumber(row, 'f'),
      bestRank: getNumber(row, 'br'),
      lastTop500: typeof lastTop500 === 'string' && lastTop500.length > 0 ? lastTop500 : null,
      daysSince: getNumber(row, 'ls'),
    }
  })
}
