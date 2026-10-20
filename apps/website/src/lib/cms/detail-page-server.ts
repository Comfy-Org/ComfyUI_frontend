import type { APIContext } from 'astro'

import { CATALOG_LOCALES } from '@/config/catalog-locales'
import type { Locale } from '@/config/locales'
import { isIndexableModelPage } from '@/config/indexing'
import { modelDeveloper } from '@/config/model-vendors'
import { modelsPageDataSchema } from '@/config/models-page-data'
import type { ModelsPageData } from '@/config/models-page-data'
import { modelMetaDescription } from '@/lib/workshop/model-meta-description'
import { modelTitle } from '@/lib/workshop/model-title'
import { modelOgImage, prepareModelPage } from '@/routes/models/model-page'
import { pageContext } from '@/utils/jsonLd'
import { modelPageJsonLd } from '@/utils/modelJsonLd'
import { catalogUnavailable, loadSiteCatalog } from './catalog'
import { catalogLocaleTranslated } from './catalog-presentation'
import { catalogDetailPath } from './detail-route'

type DetailLocale = Parameters<typeof prepareModelPage>[1]

export type CatalogDetailLoad =
  | {
      status: 'ok'
      page: ModelsPageData
      translated: boolean
      translatedLocales: Locale[]
    }
  | { status: 'missing' | 'unavailable' }

/**
 * Server-side twin of `/models/[slug]/page.json`'s one-record catalog read,
 * so a detail page's first HTML carries the record instead of a loader. It
 * reads exactly one item (no related cards, no catalogue walk), with the same
 * session (Draft for verified staff, LIVE otherwise) the JSON route uses.
 */
export async function loadCatalogDetailPage(
  locals: Pick<APIContext['locals'], 'catalogAuthoring'>,
  pathname: string,
  locale: DetailLocale
): Promise<CatalogDetailLoad> {
  if (!catalogDetailPath(pathname)) return { status: 'missing' }
  const canonical = pathname
    .slice(hubLocalePrefix(pathname).length)
    .replace(/\/$/, '')
  const catalog = await loadSiteCatalog(
    locals.catalogAuthoring,
    locale,
    canonical,
    false
  )
  if (!catalog.ok) return { status: 'unavailable' }
  const selected = catalog.details.at(0)
  if (!selected) return { status: 'missing' }
  const page = await prepareModelPage(selected.slug, locale, catalog)
  if (page.kind !== 'page') return { status: 'missing' }
  // Same wire shape and checks as fetchCatalogDetail applies to page.json.
  const parsed = modelsPageDataSchema.safeParse(
    JSON.parse(
      JSON.stringify({
        ...page,
        catalogUID: catalog.projection.items[0]?.uid,
        canEdit: locals.catalogAuthoring?.can_edit,
        model: { ...page.model, form: undefined }
      })
    )
  )
  if (
    !parsed.success ||
    parsed.data.model.href.replace(/\/$/, '') !== canonical
  )
    return { status: 'unavailable' }
  const item = catalog.projection.items[0]
  return {
    status: 'ok',
    page: parsed.data,
    translated: catalogLocaleTranslated(item, locale ?? 'en'),
    translatedLocales: CATALOG_LOCALES.filter((code) =>
      catalogLocaleTranslated(item, code)
    )
  }
}

/** The locale prefix a Hub detail page is served under ('' for English). */
function hubLocalePrefix(pathname: string): string {
  return /^\/[a-z]{2}(?:-[A-Z]{2})?(?=\/hub\/)/.exec(pathname)?.[0] ?? ''
}

/**
 * Head metadata for a server-rendered catalog detail page, matching the static
 * Models pages: title, meta description, localized canonical, OG image and the
 * page's JSON-LD graph.
 */
export function catalogDetailHead(
  page: ModelsPageData,
  pathname: string,
  site: URL | undefined,
  currentLocale: string | undefined,
  locale: DetailLocale
) {
  const { model } = page
  const canonicalPath = hubLocalePrefix(pathname) + model.href
  const { siteUrl, url } = pageContext(site, canonicalPath, currentLocale)
  const ogImage = modelOgImage(model)
  return {
    title: modelTitle(model, locale),
    description: modelMetaDescription(page, locale),
    canonicalPath,
    ogImage,
    ogImageAlt: ogImage && `${model.name} example output`,
    jsonLd: modelPageJsonLd({
      model,
      useCaseLabel: page.useCaseLabel,
      url,
      siteUrl,
      developer: modelDeveloper(model.provider)
    })
  }
}

/**
 * Staff sessions can see unpublished Draft content, a missing or unavailable
 * record has nothing to index, an unlaunched page stays noindex as it does on
 * the static Hub, and a locale page without a reviewed translation duplicates
 * the source-language page.
 */
export function catalogDetailNoindex(
  locals: Pick<APIContext['locals'], 'catalogAuthoring'>,
  load: CatalogDetailLoad
): boolean {
  return (
    Boolean(locals.catalogAuthoring) ||
    load.status !== 'ok' ||
    !load.translated ||
    !isIndexableModelPage(load.page.model.href)
  )
}

export function catalogDetailFailure(
  load: CatalogDetailLoad
): Response | undefined {
  return load.status === 'unavailable' ? catalogUnavailable() : undefined
}
