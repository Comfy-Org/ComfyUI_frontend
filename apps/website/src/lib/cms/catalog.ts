import { zContentCatalogProjection } from '@comfyorg/ingest-types/zod'

import { modelSchema } from '@/config/models-catalogue-data'
import { detailSchema } from '@/config/models-page-data'
import type { SiteSession } from './admin'
import { normalizeProjection } from './catalog-contract'
import { catalogFetch } from './demo'

// Server-only configuration. Browser islands read same-origin JSON endpoints.
// Production keeps the static Hub even if the variable is set there.
export const cmsEnabled = () =>
  Boolean(process.env.SITE_CATALOG_API_URL) &&
  process.env.VERCEL_ENV !== 'production'

export async function loadSiteCatalog(session?: SiteSession) {
  const origin = process.env.SITE_CATALOG_API_URL
  if (!origin || !cmsEnabled()) return { ok: false, status: 503 } as const
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
  // One unreadable item drops out instead of taking every Hub page down.
  const models = projection.data.items.flatMap((item) => {
    const parsed = modelSchema.safeParse(item.data)
    return parsed.success ? [parsed.data] : []
  })
  const details = projection.data.items.flatMap((item) => {
    if (item.kind === 'APP') return []
    const parsed = detailSchema.safeParse(item.data)
    return parsed.success ? [parsed.data] : []
  })
  return { ok: true, projection: normalized, models, details } as const
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
