import type { WorkshopModel } from '@/config/models-catalogue'
import type { AuthoringSession } from './authoring-session'
import { loadSiteCatalogList } from './catalog-list'
import type { CatalogListSection } from './catalog-list'

const MAX_PAGES = 1000

/** Every card of one section, read cursor by cursor from one snapshot. */
export async function loadEverySiteCatalogCard(
  session: AuthoringSession | undefined,
  locale: string | undefined,
  section: CatalogListSection
) {
  const unavailable = { ok: false, status: 503 } as const
  const models: WorkshopModel[] = []
  const visited = new Set<string>()
  const params = new URLSearchParams()
  for (let page = 1; page <= MAX_PAGES; page++) {
    const catalog = await loadSiteCatalogList(session, locale, section, params)
    if (!catalog.ok || (page > 1 && catalog.pages[section].reset))
      return unavailable
    models.push(...catalog.models)
    const { hasNext, nextCursor } = catalog.pages[section]
    if (!hasNext) return { ok: true, models } as const
    if (!nextCursor || visited.has(nextCursor)) return unavailable
    visited.add(nextCursor)
    params.set('cursor', nextCursor)
    params.set('p', String(page + 1))
  }
  return unavailable
}
