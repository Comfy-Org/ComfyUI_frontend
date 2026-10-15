import { appModels } from '@/config/workshop-app-content'
import type { APIContext } from 'astro'
import { workshopPages } from '@/config/workshop-page-content'
import { cmsEnabled, catalogUnavailable } from '@/lib/cms/catalog'
import { loadSiteCatalogList } from '@/lib/cms/catalog-list'

export async function GET(context?: APIContext) {
  if (cmsEnabled()) {
    const params = context?.url.searchParams ?? new URLSearchParams()
    const requested = params.get('section')
    const section =
      requested === 'workflows' || requested === 'apps' ? requested : 'models'
    const catalog = await loadSiteCatalogList(
      context?.locals.catalogAuthoring ?? context?.locals.site,
      context?.locals.catalogLocale,
      section,
      params
    )
    return catalog.ok
      ? Response.json(catalog.models, {
          headers: { 'Cache-Control': 'private, no-store' }
        })
      : catalogUnavailable()
  }
  return Response.json([...workshopPages, ...appModels])
}
