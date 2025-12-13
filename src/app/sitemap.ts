import type { MetadataRoute } from 'next'

import { getMetaPayload, getTop500Payload, mapTop500Rows } from '@/lib/data'

export const dynamic = 'force-static'

const baseUrl = 'https://music.eduardlupu.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [payload, meta] = await Promise.all([getTop500Payload(), getMetaPayload()])
  const artists = mapTop500Rows(payload)
  const lastModified = new Date(meta?.generatedAt ?? payload.date)

  const urls: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified },
    { url: `${baseUrl}/former`, lastModified },
    { url: `${baseUrl}/world-map`, lastModified },
    { url: `${baseUrl}/graph`, lastModified },
  ]

  artists.forEach((artist) => {
    urls.push({ url: `${baseUrl}/artist/${artist.id}`, lastModified })
  })

  return urls
}
