import { appModels } from '@/config/workshop-app-content'
import type { APIContext } from 'astro'
import { workshopPages } from '@/config/workshop-page-content'
import { cmsEnabled, catalogUnavailable } from '@/lib/cms/catalog'
import { loadSiteCatalogList } from '@/lib/cms/catalog-list'
import { isCatalogLocale } from '@/config/catalog-locales'

export async function GET(context?: APIContext) {
  return cmsEnabled()
    ? catalogResponse(context)
    : Response.json([...workshopPages, ...appModels])
}
function listRequest(context?: APIContext) {
  const params = context?.url.searchParams ?? new URLSearchParams()
  const locale = params.get('format') === 'page' ? params.get('locale') : null
  if (locale && !isCatalogLocale(locale))
    return new Response('Invalid catalog locale', { status: 400 })
  const requested = params.get('section')
  const section =
    requested === 'workflows' || requested === 'apps' ? requested : 'models'
  return { params, locale, section } as const
}
async function catalogResponse(context?: APIContext) {
  const request = listRequest(context)
  if (request instanceof Response) return request
  const { params, locale, section } = request
  const catalog = await loadSiteCatalogList(
    context?.locals.catalogAuthoring ?? context?.locals.site,
    locale ?? context?.locals.catalogLocale,
    section,
    params
  )
  return catalog.ok
    ? Response.json(
        params.get('format') === 'page'
          ? {
              models: catalog.models,
              pages: catalog.pages,
              facets: catalog.facets
            }
          : catalog.models,
        {
          headers: { 'Cache-Control': 'private, no-store' }
        }
      )
    : catalogUnavailable()
}
