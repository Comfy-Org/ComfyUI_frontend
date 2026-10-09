import { zContentCatalogProjection } from '@comfyorg/ingest-types/zod'
import { z } from 'astro/zod'

import { modelSchema } from '@/config/models-catalogue-data'
import { detailSchema } from '@/config/models-page-data'
import type { SiteSession } from './admin'
import { normalizeProjection } from './catalog-contract'
import { catalogFetch } from './demo'

// Server-only configuration. Browser islands read same-origin JSON endpoints.
export const cmsEnabled = () => Boolean(process.env.SITE_CATALOG_API_URL)

export async function loadSiteCatalog(session?: SiteSession) {
  const origin = process.env.SITE_CATALOG_API_URL
  if (!origin || process.env.VERCEL_ENV === 'production')
    return { ok: false, status: 503 } as const
  let data: unknown
  try {
    const url = new URL(
      session ? '/admin/api/site/catalog' : '/api/v1/catalog/items',
      origin
    )
    if (session) {
      url.searchParams.set('view', session.preview?.view ?? 'LIVE')
      url.searchParams.set('eligible', 'true')
      if (session.preview?.now) url.searchParams.set('now', session.preview.now)
    }
    const response = await catalogFetch(url, {
      ...(session
        ? { headers: { Authorization: `Bearer ${session.credential}` } }
        : {}),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    })
    if (!response.ok) return { ok: false, status: 503 } as const
    data = await response.json()
  } catch {
    return { ok: false, status: 503 } as const
  }
  const projection = zContentCatalogProjection.safeParse(data)
  if (!projection.success) return { ok: false, status: 503 } as const
  const normalized = normalizeProjection(projection.data)
  if (!normalized) return { ok: false, status: 503 } as const
  const models = z
    .array(modelSchema)
    .safeParse(projection.data.items.map((item) => item.data))
  const details = z
    .array(detailSchema)
    .safeParse(
      projection.data.items
        .filter((item) => item.kind !== 'APP')
        .map((item) => item.data)
    )
  if (!models.success || !details.success)
    return { ok: false, status: 503 } as const
  return {
    ok: true,
    projection: normalized,
    models: models.data,
    details: details.data
  } as const
}

export function catalogUnavailable() {
  return new Response('CMS temporarily unavailable', {
    status: 503,
    headers: {
      'Cache-Control': 'private, no-store',
      'Retry-After': '5',
      'X-Robots-Tag': 'noindex'
    }
  })
}
