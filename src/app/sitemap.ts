import type { MetadataRoute } from 'next'

import { getMetaPayload, getTop500Payload, mapTop500Rows } from '@/lib/data'

export const dynamic = 'force-static'

const baseUrl = 'https://music.eduardlupu.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [payload, meta] = await Promise.all([getTop500Payload(), getMetaPayload()])
  const artists = mapTop500Rows(payload)
  const lastModified = meta?.generatedAt ?? payload.date

  const urls: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified },
    { url: `${baseUrl}/world-map`, lastModified },
  ]

  artists.forEach((artist) => {
    urls.push({ url: `${baseUrl}/artist/${artist.id}`, lastModified })
  })

  return urls
}
