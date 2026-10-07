import type { APIRoute, GetStaticPaths } from 'astro'

import { workshopPages } from '@/config/workshop-page-content'
import { prepareModelPage } from './model-page'
import {
  cmsEnabled,
  loadSiteCatalog,
  catalogUnavailable
} from '@/lib/cms/catalog'

export const getStaticPaths: GetStaticPaths = () =>
  workshopPages.map((model) => ({ params: { slug: model.slug } }))

export const GET: APIRoute = async ({ params, locals }) => {
  const catalog = cmsEnabled() ? await loadSiteCatalog(locals.site) : undefined
  if (catalog && !catalog.ok) return catalogUnavailable()
  if (catalog?.ok && !catalog.details.some((item) => item.slug === params.slug))
    return new Response('Not found', { status: 404 })
  const page = await prepareModelPage(
    params.slug,
    'en',
    catalog?.ok ? catalog : undefined
  )
  if (page.kind !== 'page') throw new Error('Expected a canonical Models route')
  return new Response(
    JSON.stringify({
      ...page,
      model: { ...page.model, form: undefined }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
