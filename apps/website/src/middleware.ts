import type { APIContext } from 'astro'
import type { ContentCatalogReview } from '@comfyorg/ingest-types'
import { defineMiddleware } from 'astro:middleware'
import { resolveLocale } from './config/locales'
import { translationsFor } from './i18n/translations'
import { isLocalAccess } from '@/routes/admin/local-access'
import { demoMode } from '@/lib/cms/demo'
import { TESTER_COOKIE, localCredential, verifyTester } from '@/lib/cms/testers'
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

function isSignIn(context: APIContext) {
  const path = context.url.pathname
  if (
    [
      '/admin/local-access',
      '/admin/sign-in',
      '/admin/sign-in/',
      '/admin/tester-session'
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

const handle = defineMiddleware(async (context, next) => {
  context.locals.t = translationsFor(resolveLocale(context.currentLocale)).t
  const admin = isAdmin(context.url.pathname)
  if (context.isPrerendered) return admin ? denied(404) : next()
  const cms = Boolean(process.env.SITE_CATALOG_API_URL)
  context.locals.siteDemo = cms && demoMode()
  context.locals.siteLocalAccess =
    cms && (isLocalAccess(context) || context.locals.siteDemo)
  const signIn = isSignIn(context)
  if (cms && !signIn) {
    const failure = await authenticate(context)
    if (failure) return failure
  }
  if (admin && !signIn && !context.locals.site) return denied(404)
  const selection = selectPreview(context)
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

// TEMPORARY: show the failure on the demo preview to diagnose a Vercel-only 500.
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const response = await handle(context, next)
    if (!response) throw new Error('Middleware returned no response')
    return response
  } catch (error) {
    if (!demoMode()) throw error
    return new Response(
      `Demo error\n${error instanceof Error ? error.stack : String(error)}`,
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    )
  }
})
