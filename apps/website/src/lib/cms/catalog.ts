import { zContentCatalogProjection } from '@comfyorg/ingest-types/zod'

import { modelSchema } from '@/config/models-catalogue-data'
import { detailSchema } from '@/config/models-page-data'
import type { SiteSession } from './admin'
import type { AuthoringSession } from './authoring-session'
import { catalogPresentation } from './catalog-presentation'
import { normalizeProjection } from './catalog-contract'
import { boundedBody } from './editor-server'
import { loadSiteCatalogList } from './catalog-list'
import { cmsEnabled } from './cms-enabled'

export { cmsEnabled }

async function fetchDetail(
  origin: string,
  workflowSlug: string,
  session?: SiteSession | AuthoringSession
) {
  try {
    const url = detailURL(origin, workflowSlug, session)
    const response = await fetch(url, {
      ...(session
        ? { headers: { Authorization: `Bearer ${session.credential}` } }
        : {}),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    })
    if (!response.ok) return
    const bytes = await boundedBody(response, 4 << 20)
    if (!bytes) return
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return data
  } catch {
    return undefined
  }
}
function detailURL(
  origin: string,
  workflowSlug: string,
  session?: SiteSession | AuthoringSession
) {
  const url = new URL(
    session ? '/admin/api/site/catalog' : '/api/v1/catalog/items',
    origin
  )
  if (session) {
    url.searchParams.set('view', session.preview?.view ?? 'LIVE')
    url.searchParams.set('eligible', 'true')
    if (session.preview?.now) url.searchParams.set('now', session.preview.now)
  }
  url.searchParams.set('workflow_slug', workflowSlug)
  return url
}
function parseDetail(data: unknown, locale: string, preview: boolean) {
  const projection = zContentCatalogProjection.safeParse(data)
  if (!projection.success || projection.data.items.length > 1) return undefined
  const normalized = normalizeProjection(projection.data)
  if (!normalized) return undefined
  const readable = normalized.items.flatMap((item) => {
    const presented = catalogPresentation(
      item,
      locale,
      preview,
      normalized.items
    )
    const model = modelSchema.safeParse(presented)
    const detail =
      item.kind === 'APP' ? undefined : detailSchema.safeParse(presented)
    if (!model.success || detail?.success === false) return []
    return [{ item, model: model.data, detail: detail?.data }]
  })
  return {
    normalized: { ...normalized, items: readable.map(({ item }) => item) },
    models: readable.map(({ model }) => model),
    details: readable.flatMap(({ detail }) => (detail ? [detail] : []))
  }
}
export async function loadSiteCatalog(
  session?: SiteSession | AuthoringSession,
  locale = 'en',
  workflowSlug?: string,
  includeRelated = true
) {
  const origin = process.env.SITE_CATALOG_API_URL
  if (!origin || !workflowSlug || !cmsEnabled())
    return { ok: false, status: 503 } as const
  const data = await fetchDetail(origin, workflowSlug, session)
  const parsed = parseDetail(data, locale, session?.preview?.view === 'DRAFT')
  if (!parsed) return { ok: false, status: 503 } as const
  const { normalized, models, details } = parsed
  const kind = normalized.items[0]?.kind
  const related =
    includeRelated && normalized.items.length > 0
      ? await loadSiteCatalogList(
          session,
          locale,
          kind === 'APP' ? 'apps' : kind === 'WORKFLOW' ? 'workflows' : 'models'
        )
      : undefined
  const cards = related?.ok ? related.models : []
  const ownSlugs = new Set(models.map((item) => item.slug))
  return {
    ok: true,
    projection: normalized,
    models: [...models, ...cards.filter((item) => !ownSlugs.has(item.slug))],
    details
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
