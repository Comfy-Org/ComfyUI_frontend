import type {
  CccWebsiteCardsPage,
  ListCccWebsiteCardsData
} from '@comfyorg/ingest-types'
import { zListCccWebsiteCardsQuery } from '@comfyorg/ingest-types/zod'

import { USE_CASES } from '@/config/models-catalogue'
import type { UseCase, SortOrder } from '@/config/models-catalogue'
import { modelSchema } from '@/config/models-catalogue-data'
import { workflowCategoryLabel } from '@/lib/workshop/workflow-category-label'
import type { SiteSession } from './admin'
import type { AuthoringSession } from './authoring-session'
import { readCatalogCards } from './catalog-cards-response'
import { catalogPresentation } from './catalog-presentation'
import { cmsEnabled } from './cms-enabled'

export type CatalogListSection = 'models' | 'workflows' | 'apps'
type ListCccWebsiteCardsQuery = NonNullable<ListCccWebsiteCardsData['query']>

export interface CatalogListPage {
  page: number
  pageSize: number
  total?: number
  totalPages?: number
  hasPrevious: boolean
  hasNext: boolean
  mode?: 'cursor'
  count?: number
  nextCursor?: string
  previousCursor?: string
  available?: boolean
  reset?: boolean
}

export interface CatalogListFacets {
  models: {
    useCases: { value: UseCase; count?: number }[]
    sortOrders: readonly SortOrder[]
  }
  workflows: {
    categories: { value: string; label: string; count?: number }[]
    models: { value: string; label?: string; count?: number }[]
  }
}

export type CatalogListPages = Record<CatalogListSection, CatalogListPage>
const KINDS = { models: 'MODEL', workflows: 'WORKFLOW', apps: 'APP' } as const

function pageNumber(value: string | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) ? page : 1
}

function cardQuery(
  params: URLSearchParams,
  section: CatalogListSection,
  locale: string
) {
  return zListCccWebsiteCardsQuery.safeParse({
    kind: KINDS[section],
    limit: 24,
    locale,
    cursor: params.get('cursor') || undefined,
    q: params.get('q') ?? undefined,
    sort: params.get('sort') ?? 'popular',
    category: params.getAll('category'),
    model: params.getAll('model'),
    use: [...params.getAll('use'), ...params.getAll('useCase')].flatMap(
      (value) =>
        value === 'all'
          ? []
          : value === 'other'
            ? ['text', '3d', 'audio']
            : [value]
    ),
    modality: params.getAll('modality'),
    provider: params.getAll('provider'),
    capability: params.getAll('capability')
  })
}

function listPages(
  value: CccWebsiteCardsPage,
  section: CatalogListSection,
  page: number,
  reset: boolean
): CatalogListPages {
  function entry(tab: CatalogListSection): CatalogListPage {
    const active = tab === section
    return {
      mode: 'cursor',
      page: active ? page : 1,
      pageSize: value.page_size,
      available: value.available_kinds.includes(KINDS[tab]),
      count: active ? value.items.length : 0,
      ...(active
        ? {
            total: value.total,
            nextCursor: value.next_cursor,
            previousCursor: value.previous_cursor,
            reset
          }
        : {}),
      hasPrevious: active && Boolean(value.previous_cursor),
      hasNext: active && value.has_more
    }
  }
  return {
    models: entry('models'),
    workflows: entry('workflows'),
    apps: entry('apps')
  }
}

function listFacets(
  value: CccWebsiteCardsPage,
  locale: string
): CatalogListFacets {
  return {
    models: {
      useCases: value.facets.use_cases.flatMap((facet) => {
        const useCase = USE_CASES.find((useCase) => useCase === facet.value)
        return useCase ? [{ value: useCase, count: facet.count }] : []
      }),
      sortOrders: value.sort_orders
    },
    workflows: {
      categories: value.facets.categories
        .filter((facet) => facet.value.trim())
        .map((facet) => ({
          ...facet,
          label:
            facet.label.trim() ||
            workflowCategoryLabel({ category: facet.value }, locale)
        })),
      models: value.facets.models
    }
  }
}

export async function loadSiteCatalogList(
  session: SiteSession | AuthoringSession | undefined,
  locale = 'en',
  section: CatalogListSection = 'models',
  params = new URLSearchParams()
) {
  const unavailable = { ok: false, status: 503 } as const
  const origin = process.env.SITE_CATALOG_API_URL
  if (!origin || !cmsEnabled()) return unavailable
  const query = cardQuery(params, section, locale)
  if (!query.success) return unavailable
  let page = pageNumber(params.get('p'))
  let reset = page > 1 && !query.data.cursor
  if (reset) page = 1
  try {
    const result = await fetchCards(origin, query.data, session)
    if (result.reset) {
      page = 1
      reset = true
    }
    const { response } = result
    if (!response.ok) return unavailable
    const value = await readCatalogCards(response)
    if (!value || !validCards(value, section, Boolean(session)))
      return unavailable
    const models = modelSchema
      .array()
      .safeParse(
        value.items.map((item) =>
          catalogPresentation(item, locale, session?.preview?.view === 'DRAFT')
        )
      )
    if (!models.success) return unavailable
    return {
      ok: true,
      models: models.data,
      pages: listPages(value, section, page, reset),
      facets: listFacets(value, locale)
    } as const
  } catch {
    return unavailable
  }
}

function cardsURL(
  origin: string,
  query: ListCccWebsiteCardsQuery,
  session?: SiteSession | AuthoringSession
) {
  const url = new URL(
    session ? '/admin/api/site/catalog/cards' : '/api/v1/catalog/cards',
    origin
  )
  appendCardQuery(url.searchParams, query)
  if (session) {
    url.searchParams.set('view', session.preview?.view ?? 'LIVE')
    if (session.preview?.now) url.searchParams.set('now', session.preview.now)
  }
  return url
}
function appendCardQuery(
  params: URLSearchParams,
  query: ListCccWebsiteCardsQuery
) {
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value))
      value.forEach((entry) => params.append(key, entry))
    else if (typeof value === 'string' || typeof value === 'number')
      params.set(key, String(value))
  }
}
async function fetchCards(
  origin: string,
  query: ListCccWebsiteCardsQuery,
  session?: SiteSession | AuthoringSession
) {
  const url = cardsURL(origin, query, session)
  const options: RequestInit = {
    ...(session
      ? { headers: { Authorization: `Bearer ${session.credential}` } }
      : {}),
    signal: AbortSignal.timeout(5000),
    cache: 'no-store'
  }
  const response = await fetch(url, options)
  if (response.status !== 409 || !url.searchParams.has('cursor'))
    return { response, reset: false }
  await response.body?.cancel()
  url.searchParams.delete('cursor')
  return { response: await fetch(url, options), reset: true }
}
function validCards(
  value: CccWebsiteCardsPage,
  section: CatalogListSection,
  authenticated: boolean
) {
  if (
    value.items.some(
      (item) =>
        item.kind !== KINDS[section] ||
        item.deleted ||
        !item.enabled ||
        (!authenticated && item.visibility !== 'PUBLIC')
    )
  )
    return false
  return authenticated || !hasPrivateCounts(value)
}
function hasPrivateCounts(value: CccWebsiteCardsPage) {
  return (
    value.total !== undefined ||
    value.generation !== undefined ||
    Object.values(value.facets).some((facets) =>
      facets.some((facet) => facet.count !== undefined)
    )
  )
}
