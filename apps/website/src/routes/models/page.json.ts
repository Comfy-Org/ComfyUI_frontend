import type { APIRoute, GetStaticPaths } from 'astro'

import { workshopPages } from '@/config/workshop-page-content'
import { prepareModelPage } from './model-page'
import { catalogDetailPath } from '@/lib/cms/detail-route'
import {
  cmsEnabled,
  loadSiteCatalog,
  catalogUnavailable
} from '@/lib/cms/catalog'

export const getStaticPaths: GetStaticPaths = () =>
  workshopPages.map((model) => ({ params: { slug: model.slug } }))

export const GET: APIRoute = async ({ params, locals, url }) => {
  const target = url.searchParams.get('path')
  const requestedLocale = url.searchParams.get('locale')
  if (
    requestedLocale !== null &&
    requestedLocale !== 'en' &&
    requestedLocale !== 'zh-CN'
  )
    return new Response('Invalid content locale', { status: 400 })
  const locale =
    requestedLocale ?? (locals.catalogLocale === 'zh-CN' ? 'zh-CN' : 'en')
  if (target && !catalogDetailPath(target))
    return new Response('Invalid content route', { status: 400 })
  const catalog = cmsEnabled()
    ? await loadSiteCatalog(
        locals.catalogAuthoring ?? locals.site,
        locale,
        target ?? params.slug,
        !target
      )
    : undefined
  if (catalog && !catalog.ok) return catalogUnavailable()
  const selected = catalog?.ok ? catalog.details[0] : undefined
  if (catalog?.ok && !selected)
    return new Response('Not found', { status: 404 })
  const page = await prepareModelPage(
    selected?.slug ?? params.slug,
    locale,
    catalog?.ok ? catalog : undefined
  )
  if (page.kind !== 'page') throw new Error('Expected a canonical Models route')
  return new Response(
    JSON.stringify({
      ...page,
      catalogUID: catalog?.ok ? catalog.projection.items[0]?.uid : undefined,
      canEdit: locals.catalogAuthoring?.can_edit,
      model: { ...page.model, form: undefined }
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...(catalog?.ok
          ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
          : {})
      }
    }
  )
}
