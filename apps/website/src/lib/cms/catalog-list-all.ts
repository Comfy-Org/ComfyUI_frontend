import type { WorkshopModel } from '@/config/models-catalogue'
import type { AuthoringSession } from './authoring-session'
import { loadSiteCatalogList } from './catalog-list'
import type { CatalogListSection } from './catalog-list'

const MAX_PAGES = 1000

interface CursorPage<T> {
  items: readonly T[]
  nextCursor?: string
}

/**
 * Every item of a cursor-paged read, page by page. Undefined when a page
 * cannot be read, a cursor repeats, or the cap stops the walk early.
 */
export async function everyCursorPage<T>(
  readPage: (
    cursor: string | undefined,
    page: number
  ) => Promise<CursorPage<T> | undefined>,
  maxPages = MAX_PAGES
): Promise<T[] | undefined> {
  const items: T[] = []
  const visited = new Set<string>()
  let cursor: string | undefined
  for (let page = 1; page <= maxPages; page++) {
    const result = await readPage(cursor, page)
    if (!result) return undefined
    items.push(...result.items)
    if (!result.nextCursor) return items
    if (visited.has(result.nextCursor)) return undefined
    visited.add(result.nextCursor)
    cursor = result.nextCursor
  }
  return undefined
}

/** Every card of one section, read cursor by cursor from one snapshot. */
export async function loadEverySiteCatalogCard(
  session: AuthoringSession | undefined,
  locale: string | undefined,
  section: CatalogListSection
) {
  const models = await everyCursorPage<WorkshopModel>(async (cursor, page) => {
    const params = new URLSearchParams(
      cursor ? { cursor, p: String(page) } : {}
    )
    const catalog = await loadSiteCatalogList(session, locale, section, params)
    if (!catalog.ok || (page > 1 && catalog.pages[section].reset))
      return undefined
    const { hasNext, nextCursor } = catalog.pages[section]
    if (hasNext && !nextCursor) return undefined
    return {
      items: catalog.models,
      nextCursor: hasNext ? nextCursor : undefined
    }
  })
  return models
    ? ({ ok: true, models } as const)
    : ({ ok: false, status: 503 } as const)
}
