import { zContentCatalogProjection } from '@comfyorg/ingest-types/zod'
import { z } from 'astro/zod'

import {
  countByUseCase,
  filterWorkshopModels,
  parseCatalogSearch,
  sortWorkshopModels,
  USE_CASES,
  sortOrdersFor
} from '@/config/models-catalogue'
import type {
  UseCase,
  SortOrder,
  WorkshopModel
} from '@/config/models-catalogue'
import { modelSchema } from '@/config/models-catalogue-data'
import type { SiteSession } from './admin'
import type { AuthoringSession } from './authoring-session'
import { normalizeProjection } from './catalog-contract'
import { catalogPresentation } from './catalog-presentation'

export type CatalogListSection = 'models' | 'workflows' | 'apps'
const CATALOG_PAGE_SIZE = 24

export interface CatalogListPage {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
}

export interface CatalogListFacets {
  models: {
    useCases: { value: UseCase; count: number }[]
    sortOrders: readonly SortOrder[]
  }
  workflows: {
    categories: {
      value: string
      label: string
      count: number
    }[]
    models: { value: string; count: number }[]
  }
}

export type CatalogListPages = Record<CatalogListSection, CatalogListPage>

function sectionFor(model: WorkshopModel): CatalogListSection {
  return model.type === 'APP'
    ? 'apps'
    : model.type === 'CLOUD' || model.type === 'SERVERLESS'
      ? 'workflows'
      : 'models'
}

function pageNumber(value: string | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) ? page : 1
}

function orderFor(value: string | null): SortOrder {
  return value === 'name' || value === 'priceAsc' || value === 'priceDesc'
    ? value
    : 'popular'
}

function listFacets(
  models: readonly WorkshopModel[],
  locale: string
): CatalogListFacets {
  const counts = countByUseCase(
    models.filter((m) => sectionFor(m) === 'models')
  )
  const categories = new Map<
    string,
    { value: string; label: string; count: number }
  >()
  const runsOn = new Map<string, number>()
  for (const model of models) {
    if (model.type !== 'CLOUD' && model.type !== 'SERVERLESS') continue
    const value = model.category ?? ''
    const prior = categories.get(value)
    categories.set(value, {
      value,
      label:
        model.categoryLabel?.[locale === 'zh-CN' ? 'zh-CN' : 'en'] ?? value,
      count: (prior?.count ?? 0) + 1
    })
    for (const name of new Set(model.models ?? []))
      runsOn.set(name, (runsOn.get(name) ?? 0) + 1)
  }
  return {
    models: {
      useCases: USE_CASES.map((value) => ({ value, count: counts[value] })),
      sortOrders: sortOrdersFor(
        models.filter((m) => sectionFor(m) === 'models')
      )
    },
    workflows: {
      categories: [...categories.values()].slice(0, 100),
      models: [...runsOn]
        .slice(0, 100)
        .map(([value, count]) => ({ value, count }))
    }
  }
}

// Server-only reader. Upstream currently supplies a complete selected projection;
// the browser receives only bounded, schema-stripped card summaries and counts.
export async function loadSiteCatalogList(
  session: SiteSession | AuthoringSession | undefined,
  locale = 'en',
  section: CatalogListSection = 'models',
  params = new URLSearchParams()
) {
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
    const response = await fetch(url, {
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
  const parsed = z
    .array(modelSchema)
    .safeParse(
      normalized.items.map((item) =>
        catalogPresentation(item, locale, session?.preview?.view === 'DRAFT')
      )
    )
  if (!parsed.success) return { ok: false, status: 503 } as const
  const facets = listFacets(parsed.data, locale)
  const pages: CatalogListPages = {
    models: emptyPage(),
    workflows: emptyPage(),
    apps: emptyPage()
  }
  const models = (['models', 'workflows', 'apps'] as const).flatMap((tab) => {
    let matching: WorkshopModel[] = parsed.data.filter(
      (m) => sectionFor(m) === tab
    )
    const active = tab === section
    const order = active ? orderFor(params.get('sort')) : 'popular'
    if (active) {
      matching = filterWorkshopModels(matching, {
        ...parseCatalogSearch(params.toString()),
        useCase: 'all',
        useCases: [
          ...params.getAll('use'),
          ...params.getAll('useCase')
        ].flatMap((value) =>
          value === 'other'
            ? USE_CASES.filter((useCase) =>
                ['text', '3d', 'audio'].includes(useCase)
              )
            : USE_CASES.filter((useCase) => useCase === value)
        )
      })
      if (tab === 'workflows') {
        const categories = params.getAll('category').filter(Boolean)
        const runsOn = params.getAll('model').filter(Boolean)
        matching = matching.filter(
          (m) =>
            (m.type === 'CLOUD' || m.type === 'SERVERLESS') &&
            (!categories.length || categories.includes(m.category ?? '')) &&
            (!runsOn.length || m.models?.some((name) => runsOn.includes(name)))
        )
      }
    }
    matching = sortWorkshopModels(matching, order)
    if (tab === 'workflows' && order === 'popular')
      matching.sort((a, b) =>
        a.type === 'CLOUD' || a.type === 'SERVERLESS'
          ? b.type === 'CLOUD' || b.type === 'SERVERLESS'
            ? (a.categoryOrder ?? Infinity) - (b.categoryOrder ?? Infinity) ||
              (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity)
            : 0
          : 0
      )
    const total = matching.length
    const totalPages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE))
    const page = Math.min(active ? pageNumber(params.get('p')) : 1, totalPages)
    pages[tab] = {
      page,
      pageSize: CATALOG_PAGE_SIZE,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages
    }
    return matching.slice(
      (page - 1) * CATALOG_PAGE_SIZE,
      page * CATALOG_PAGE_SIZE
    )
  })
  return { ok: true, models, pages, facets } as const
}

function emptyPage(): CatalogListPage {
  return {
    page: 1,
    pageSize: CATALOG_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false
  }
}
