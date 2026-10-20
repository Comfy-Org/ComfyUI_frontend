import type { APIRoute, APIContext, GetStaticPaths } from 'astro'

import { workshopPages } from '@/config/workshop-page-content'
import { prepareModelPage } from './model-page'
import { catalogDetailPath } from '@/lib/cms/detail-route'
import { isCatalogLocale } from '@/config/catalog-locales'
import type { CatalogLocale } from '@/config/catalog-locales'
import {
  cmsEnabled,
  loadSiteCatalog,
  catalogUnavailable
} from '@/lib/cms/catalog'

export const getStaticPaths: GetStaticPaths = () =>
  workshopPages.map((model) => ({ params: { slug: model.slug } }))

export const GET: APIRoute = async ({ params, locals, url }) => {
  const request = detailRequest(url, locals)
  if (request instanceof Response) return request
  const { target, locale } = request
  const catalog = cmsEnabled()
    ? await loadSiteCatalog(
        locals.catalogAuthoring,
        locale,
        target ?? params.slug,
        !target
      )
    : undefined
  if (catalog && !catalog.ok) return catalogUnavailable()
  return detailResponse(
    params.slug,
    locals,
    locale,
    catalog?.ok ? catalog : undefined
  )
}

function detailRequest(
  url: URL,
  locals: APIContext['locals']
): Response | { target: string | null; locale: CatalogLocale } {
  const target = url.searchParams.get('path')
  const requestedLocale = url.searchParams.get('locale')
  if (requestedLocale !== null && !isCatalogLocale(requestedLocale))
    return new Response('Invalid content locale', { status: 400 })
  const locale = requestedLocale ?? locals.catalogLocale ?? 'en'
  if (target && !catalogDetailPath(target))
    return new Response('Invalid content route', { status: 400 })
  return { target, locale }
}
type DetailCatalog = Extract<
  Awaited<ReturnType<typeof loadSiteCatalog>>,
  { ok: true }
>
async function detailResponse(
  slug: string | undefined,
  locals: APIContext['locals'],
  locale: CatalogLocale,
  catalog?: DetailCatalog
) {
  const selected = catalog?.details[0]
  if (catalog && !selected) return new Response('Not found', { status: 404 })
  const page = await prepareModelPage(selected?.slug ?? slug, locale, catalog)
  if (page.kind !== 'page') throw new Error('Expected a canonical Models route')
  return new Response(
    JSON.stringify({
      ...page,
      catalogUID: catalog?.projection.items[0]?.uid,
      canEdit: locals.catalogAuthoring?.can_edit,
      model: { ...page.model, form: undefined }
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...(catalog
          ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
          : {})
      }
    }
  )
}
