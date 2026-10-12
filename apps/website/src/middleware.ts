import type { APIContext } from 'astro'
import type { ContentCatalogReview } from './lib/cms/review-contract'
import { defineMiddleware } from 'astro:middleware'
import { resolveLocale } from './config/locales'
import { translationsFor } from './i18n/translations'
import { isLocalAccess } from '@/routes/admin/local-access'
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
  if (!tester) return review
  return {
    ...review,
    can_edit: review.can_edit && tester.role !== 'review',
    can_apply: review.can_apply && tester.role === 'publish'
  }
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

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.catalogLocale =
    context.url.pathname.startsWith('/zh-CN/') ||
    context.cookies.get(CATALOG_LOCALE_COOKIE)?.value === 'zh-CN'
      ? 'zh-CN'
      : 'en'
  context.locals.t = translationsFor(resolveLocale(context.currentLocale)).t
  const admin = isAdmin(context.url.pathname)
  if (context.isPrerendered) return admin ? denied(404) : next()
  const cms = Boolean(process.env.SITE_CATALOG_API_URL)
  if (context.url.pathname.startsWith('/catalog-media/')) return next()
  if (context.url.pathname.replace(/\/$/, '') === '/admin/content-session') {
    if (!cms) return editorFailure(503)
    const response = await next()
    for (const [name, value] of Object.entries(editorHeaders))
      response.headers.set(name, value)
    return response
  }
  if (
    isAuthoringRoute(context.url.pathname) ||
    context.url.pathname === '/admin/catalog-testers' ||
    context.url.pathname.startsWith('/preview-media/')
  ) {
    if (!cms) return editorFailure(503)
    const verified = await loadAuthoringSession(context)
    if (!verified.ok) return verified.response
    context.locals.catalogAuthoring = verified.session
    context.locals.catalogAuthoring.preview = currentCatalogPreview(context)
    const response = await next()
    for (const [name, value] of Object.entries(editorHeaders))
      response.headers.set(name, value)
    return response
  }
  if (
    cms &&
    (/^\/(?:zh-CN\/)?hub\//.test(context.url.pathname) ||
      context.url.pathname.startsWith('/models/') ||
      context.url.pathname === '/') &&
    (context.cookies.has(AUTHORING_COOKIE) || context.cookies.has(DEMO_COOKIE))
  ) {
    const verified = await loadAuthoringSession(context)
    if (verified.ok) {
      context.locals.catalogAuthoring = {
        ...verified.session,
        preview: currentCatalogPreview(context)
      }
      const selection = selectCatalogPreview(context)
      if (selection) return selection
      const response = await next()
      for (const [name, value] of Object.entries(editorHeaders))
        response.headers.set(name, value)
      return response
    }
    // Never silently downgrade an attempted private Preview to anonymous Live.
    if (
      context.cookies.has('comfy_catalog_preview') ||
      context.url.searchParams.has('preview') ||
      context.url.searchParams.has('preview_at') ||
      context.url.searchParams.has('now')
    )
      return verified.response
  }
  context.locals.siteLocalAccess = cms && isLocalAccess(context)
  const signIn = isSignIn(context)
  const publicDocumentation = isPublicCatalogDocumentation(context)
  // Discovery is public and does not read staff state or act on Preview controls.
  // An expired staff/tester cookie must not block it or grant content authority.
  if (cms && !signIn && !publicDocumentation) {
    const failure = await authenticate(context)
    if (failure) return failure
  }
  if (admin && !signIn && !context.locals.site) return denied(404)
  const selection = publicDocumentation ? undefined : selectPreview(context)
  if (!publicDocumentation && context.url.searchParams.has('preview_at'))
    return denied()
  if (selection) return selection
  const response = await next()
  if (cms) {
    // Private test preview, not the production cache policy.
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('X-Comfy-Content-Source', 'cms')
  }
  return response
})
