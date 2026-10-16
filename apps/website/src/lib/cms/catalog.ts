import { zContentCatalogProjection } from '@comfyorg/ingest-types/zod'

import { modelSchema } from '@/config/models-catalogue-data'
import { detailSchema } from '@/config/models-page-data'
import type { SiteSession } from './admin'
import { normalizeProjection } from './catalog-contract'
import { cmsEnabled } from './cms-enabled'
import { catalogFetch } from './demo'

export { cmsEnabled }

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
  // An item that fails either schema drops out of every list, so its page
  // returns 404 instead of taking every Hub page down.
  const readable = normalized.items.flatMap((item) => {
    const model = modelSchema.safeParse(item.data)
    const detail =
      item.kind === 'APP' ? undefined : detailSchema.safeParse(item.data)
    if (!model.success || detail?.success === false) return []
    return [{ item, model: model.data, detail: detail?.data }]
  })
  return {
    ok: true,
    projection: { ...normalized, items: readable.map(({ item }) => item) },
    models: readable.map(({ model }) => model),
    details: readable.flatMap(({ detail }) => (detail ? [detail] : []))
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
