import { appModels } from '@/config/workshop-app-content'
import type { APIContext } from 'astro'
import { workshopPages } from '@/config/workshop-page-content'
import {
  cmsEnabled,
  loadSiteCatalog,
  catalogUnavailable
} from '@/lib/cms/catalog'

export async function GET(context?: APIContext) {
  if (cmsEnabled()) {
    const catalog = await loadSiteCatalog(context?.locals.site)
    return catalog.ok ? Response.json(catalog.models) : catalogUnavailable()
  }
  return Response.json([...workshopPages, ...appModels])
}
