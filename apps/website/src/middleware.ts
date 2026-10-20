import {
  catalogResponseNoStore,
  mutableCatalogPath
} from '@/lib/cms/response-cache'
import type { APIContext, MiddlewareNext } from 'astro'
import { defineMiddleware } from 'astro:middleware'
import { resolveLocale } from './config/locales'
import { resolveCatalogLocale } from './config/catalog-locales'
import { translationsFor } from './i18n/translations'
import { DEMO_COOKIE } from '@/lib/cms/catalog-demo'
import {
  AUTHORING_COOKIE,
  isAuthoringRoute,
  loadAuthoringSession
} from '@/lib/cms/authoring-session'
import { editorFailure, editorHeaders } from '@/lib/cms/editor-server'
import {
  CATALOG_LOCALE_COOKIE,
  currentCatalogPreview,
  selectCatalogPreview
} from '@/lib/cms/catalog-preview'
import { cmsEnabled } from '@/lib/cms/cms-enabled'
import { isIndexableBuild } from '@/config/indexing'

function isAdmin(path: string) {
  return path === '/admin' || path.startsWith('/admin/')
}

function isPublicCatalogDocumentation(context: APIContext) {
  return (
    ['GET', 'HEAD'].includes(context.request.method) &&
    [
      '/agents',
      '/openapi.json',
      '/api/v1/catalog/agents',
      '/api/v1/catalog/openapi.json',
      '/api/v1/catalog/docs'
    ].includes(context.url.pathname.replace(/\/$/, ''))
  )
}

function isSignIn(context: APIContext) {
  const path = context.url.pathname
  if (
    [
      '/admin/local-access',
      '/admin/catalog-sign-in',
      '/admin/catalog-demo-session'
    ].includes(path)
  )
    return true
  return context.request.method === 'POST' && path === '/admin/local-session'
}

function denied(status = 403) {
  return new Response(status === 404 ? 'Not found' : 'Access denied', {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  })
}

function hasAuthoringCookie(context: APIContext) {
  return (
    context.cookies.has(AUTHORING_COOKIE) || context.cookies.has(DEMO_COOKIE)
  )
}

function isAdminRoot(path: string) {
  return ['/admin', '/admin/'].includes(path)
}

function isCatalogAuthoringRequest(context: APIContext) {
  const path = context.url.pathname
  return (
    isAuthoringRoute(path) ||
    (isAdminRoot(path) && hasAuthoringCookie(context)) ||
    path === '/admin/catalog-testers' ||
    path.startsWith('/preview-media/')
  )
}

function isCatalogBrowseRequest(context: APIContext) {
  const path = context.url.pathname
  return (
    (/^\/(?:zh-CN\/)?hub\//.test(path) ||
      path.startsWith('/models/') ||
      path === '/') &&
    hasAuthoringCookie(context)
  )
}

function requestedCatalogPreview(context: APIContext) {
  return (
    context.cookies.has('comfy_catalog_preview') ||
    ['preview', 'preview_at', 'now'].some((key) =>
      context.url.searchParams.has(key)
    )
  )
}

function editorResponseHeaders(response: Response) {
  for (const [name, value] of Object.entries(editorHeaders))
    response.headers.set(name, value)
  return response
}

async function authoringResponse(context: APIContext, next: MiddlewareNext) {
  const verified = await loadAuthoringSession(context)
  if (!verified.ok) return verified.response
  context.locals.catalogAuthoring = verified.session
  context.locals.catalogAuthoring.preview = currentCatalogPreview(context)
  if (isAdminRoot(context.url.pathname))
    return editorResponseHeaders(context.redirect('/admin/catalog', 303))
  return editorResponseHeaders(await next())
}

async function catalogBrowseResponse(
  context: APIContext,
  next: MiddlewareNext
) {
  const verified = await loadAuthoringSession(context)
  if (!verified.ok)
    return requestedCatalogPreview(context) ? verified.response : undefined
  context.locals.catalogAuthoring = {
    ...verified.session,
    preview: currentCatalogPreview(context)
  }
  const selection = selectCatalogPreview(context)
  return selection ?? editorResponseHeaders(await next())
}

function missingAdminSession(context: APIContext) {
  return isAdmin(context.url.pathname) && !isSignIn(context)
}
function requestedPreview(context: APIContext) {
  return (
    !isPublicCatalogDocumentation(context) &&
    ['preview', 'preview_at', 'now'].some((key) =>
      context.url.searchParams.has(key)
    )
  )
}
async function siteResponse(
  context: APIContext,
  next: MiddlewareNext,
  cms: boolean
) {
  if (missingAdminSession(context)) return denied(404)
  if (cms && requestedPreview(context)) return denied()
  const response = await next()
  if (cms) markCmsResponse(context, response)
  return response
}

function markCmsResponse(context: APIContext, response: Response) {
  response.headers.set('Cache-Control', 'private, no-store')
  if (keepOutOfSearch(context))
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('X-Comfy-Content-Source', 'cms')
}

// Crawlers honor X-Robots-Tag over page meta, so apply the same rule as the
// page: staff sessions can see unpublished Draft content, and non-indexable
// builds stay out of search. An anonymous LIVE page in an indexable build is
// left to its own robots meta (e.g. a catalog detail page's).
function keepOutOfSearch(context: APIContext) {
  return Boolean(context.locals.catalogAuthoring) || !isIndexableBuild()
}

function setRequestLocale(context: APIContext) {
  context.locals.catalogLocale = resolveCatalogLocale(
    context.url.pathname,
    context.cookies.get(CATALOG_LOCALE_COOKIE)?.value
  )
  context.locals.t = translationsFor(resolveLocale(context.currentLocale)).t
}
async function respond(context: APIContext, next: MiddlewareNext) {
  setRequestLocale(context)
  if (context.isPrerendered)
    return isAdmin(context.url.pathname) ? denied(404) : next()
  const cms = cmsEnabled()
  if (context.url.pathname.startsWith('/catalog-media/')) return next()
  const editor = await editorRouteResponse(context, next, cms)
  if (editor) return editor
  if (cms && isCatalogBrowseRequest(context)) {
    const response = await catalogBrowseResponse(context, next)
    if (response) return response
  }
  return siteResponse(context, next, cms)
}
async function editorRouteResponse(
  context: APIContext,
  next: MiddlewareNext,
  cms: boolean
) {
  if (context.url.pathname.replace(/\/$/, '') === '/admin/content-session')
    return cms ? editorResponseHeaders(await next()) : editorFailure(503)
  if (isCatalogAuthoringRequest(context))
    return cms ? authoringResponse(context, next) : editorFailure(503)
  return undefined
}

export const onRequest = defineMiddleware(async (context, next) => {
  const cms = cmsEnabled()
  const response = await respond(context, next)
  return cms && mutableCatalogPath(context.url.pathname)
    ? catalogResponseNoStore(response)
    : response
})
