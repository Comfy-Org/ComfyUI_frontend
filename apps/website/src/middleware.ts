import {
  catalogResponseNoStore,
  mutableCatalogPath
} from '@/lib/cms/response-cache'
import type { APIContext, MiddlewareNext } from 'astro'
import type { ContentCatalogReview } from './lib/cms/review-contract'
import { defineMiddleware } from 'astro:middleware'
import { resolveLocale } from './config/locales'
import { translationsFor } from './i18n/translations'
import { isLocalAccess } from '@/routes/admin/local-access'
import { demoMode } from '@/lib/cms/demo'
import { TESTER_COOKIE, localCredential, verifyTester } from '@/lib/cms/testers'
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
import {
  SESSION_COOKIE,
  CONTEXT_COOKIE,
  CSRF_COOKIE,
  cookieOptions,
  newCSRF,
  parsePreview,
  verifySiteSession
} from './lib/cms/admin'
import { narrowToLocalRole } from '@/lib/cms/catalog-capabilities'
import { cmsEnabled } from '@/lib/cms/cms-enabled'

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
      '/admin/sign-in',
      '/admin/sign-in/',
      '/admin/tester-session',
      '/admin/catalog-sign-in',
      '/admin/catalog-demo-session'
    ].includes(path)
  )
    return true
  return (
    context.request.method === 'POST' &&
    ['/admin/session', '/admin/local-session'].includes(path)
  )
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

async function credentials(context: APIContext) {
  const token = context.cookies.get(TESTER_COOKIE)?.value
  if (!token)
    return {
      credential: context.cookies.get(SESSION_COOKIE)?.value,
      tester: undefined,
      attempted: Boolean(context.cookies.get(SESSION_COOKIE)?.value)
    }
  const tester = await verifyTester(token).catch(() => undefined)
  const parent = tester ? await localCredential() : undefined
  return { credential: parent?.credential, tester, attempted: true }
}

function previewCookie(context: APIContext) {
  const preview = parsePreview(context.cookies.get(CONTEXT_COOKIE)?.value)
  if (preview?.view === 'LIVE') {
    context.cookies.delete(CONTEXT_COOKIE, { path: '/' })
    return undefined
  }
  return preview
}

function capabilities(
  review: ContentCatalogReview,
  tester: Awaited<ReturnType<typeof verifyTester>>
) {
  return tester ? narrowToLocalRole(review, tester.role) : review
}

async function authenticate(context: APIContext) {
  const { credential, tester, attempted } = await credentials(context)
  if (!attempted) return undefined
  const review = credential ? await verifySiteSession(credential) : undefined
  if (!review || !credential) {
    for (const name of [
      SESSION_COOKIE,
      TESTER_COOKIE,
      CONTEXT_COOKIE,
      CSRF_COOKIE
    ])
      context.cookies.delete(name, { path: '/' })
    return denied()
  }
  const csrf = context.cookies.get(CSRF_COOKIE)?.value ?? newCSRF()
  context.cookies.set(CSRF_COOKIE, csrf, cookieOptions(context))
  context.locals.site = {
    credential,
    review: capabilities(review, tester),
    csrf,
    preview: previewCookie(context)
  }
  return undefined
}

function previewSelection(context: APIContext) {
  const params = context.url.searchParams
  const view =
    params.get('preview') ?? context.locals.site?.preview?.view ?? 'LIVE'
  const now = params.get('now')
  return parsePreview(
    JSON.stringify({ view, ...(now && now !== 'now' ? { now } : {}) })
  )
}

function selectPreview(context: APIContext) {
  const params = context.url.searchParams
  if (!params.has('preview') && !params.has('now')) return undefined
  if (!context.locals.site) return denied()
  const preview = previewSelection(context)
  if (!preview)
    return new Response('Invalid preview selection', { status: 400 })
  if (preview.view === 'LIVE')
    context.cookies.delete(CONTEXT_COOKIE, { path: '/' })
  else
    context.cookies.set(
      CONTEXT_COOKIE,
      JSON.stringify(preview),
      cookieOptions(context)
    )
  params.delete('preview')
  params.delete('now')
  return context.redirect(context.url.pathname + context.url.search, 303)
}

function hasAuthoringCookie(context: APIContext) {
  return (
    context.cookies.has(AUTHORING_COOKIE) || context.cookies.has(DEMO_COOKIE)
  )
}

function isCatalogAuthoringRequest(context: APIContext) {
  const path = context.url.pathname
  return (
    isAuthoringRoute(path) ||
    (['/admin', '/admin/'].includes(path) && hasAuthoringCookie(context)) ||
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

async function authenticateSite(context: APIContext, cms: boolean) {
  context.locals.siteDemo = cms && demoMode()
  context.locals.siteLocalAccess =
    cms && (isLocalAccess(context) || context.locals.siteDemo)
  if (requiresSiteAuthentication(context, cms)) {
    const failure = await authenticate(context)
    if (failure) return failure
  }
  if (missingAdminSession(context))
    return context.locals.siteDemo
      ? context.redirect('/admin/local-access', 303)
      : denied(404)
  return undefined
}
function missingAdminSession(context: APIContext) {
  return (
    isAdmin(context.url.pathname) && !isSignIn(context) && !context.locals.site
  )
}
function requiresSiteAuthentication(context: APIContext, cms: boolean) {
  return cms && !isSignIn(context) && !isPublicCatalogDocumentation(context)
}
async function siteResponse(
  context: APIContext,
  next: MiddlewareNext,
  cms: boolean
) {
  const failure = await authenticateSite(context, cms)
  if (failure) return failure
  const publicDocumentation = isPublicCatalogDocumentation(context)
  const selection =
    cms && !publicDocumentation ? selectPreview(context) : undefined
  if (cms && !publicDocumentation && context.url.searchParams.has('preview_at'))
    return denied()
  if (selection) return selection
  const response = await next()
  if (cms) {
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('X-Comfy-Content-Source', 'cms')
  }
  return response
}

function setRequestLocale(context: APIContext) {
  context.locals.catalogLocale =
    context.url.pathname.startsWith('/zh-CN/') ||
    context.cookies.get(CATALOG_LOCALE_COOKIE)?.value === 'zh-CN'
      ? 'zh-CN'
      : 'en'
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
