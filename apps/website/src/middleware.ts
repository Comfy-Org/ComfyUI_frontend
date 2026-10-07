import { defineMiddleware } from 'astro:middleware'

import { resolveLocale } from './config/locales'
import { translationsFor } from './i18n/translations'
import { isLocalAccess } from '@/routes/admin/local-access'
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

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.t = translationsFor(resolveLocale(context.currentLocale)).t
  const admin =
    context.url.pathname === '/admin' ||
    context.url.pathname.startsWith('/admin/')
  if (context.isPrerendered)
    return admin ? new Response('Not found', { status: 404 }) : next()
  context.locals.siteLocalAccess =
    Boolean(process.env.SITE_CATALOG_API_URL) && isLocalAccess(context)
  const sessionEndpoint =
    (context.url.pathname === '/admin/session' &&
      context.request.method === 'POST') ||
    (context.url.pathname === '/admin/local-session' &&
      context.request.method === 'POST') ||
    context.url.pathname === '/admin/local-access' ||
    ['/admin/sign-in', '/admin/sign-in/', '/admin/tester-session'].includes(
      context.url.pathname
    )
  const testerToken = context.cookies.get(TESTER_COOKIE)?.value
  const tester =
    testerToken && !sessionEndpoint
      ? await verifyTester(testerToken).catch(() => undefined)
      : undefined
  const credential = testerToken
    ? tester
      ? (await localCredential())?.credential
      : undefined
    : context.cookies.get(SESSION_COOKIE)?.value
  if (
    process.env.SITE_CATALOG_API_URL &&
    (credential || testerToken) &&
    !sessionEndpoint
  ) {
    const review = credential ? await verifySiteSession(credential) : undefined
    if (!review) {
      for (const name of [
        SESSION_COOKIE,
        TESTER_COOKIE,
        CONTEXT_COOKIE,
        CSRF_COOKIE
      ])
        context.cookies.delete(name, { path: '/' })
      return new Response('Access denied', {
        status: 403,
        headers: { 'Cache-Control': 'private, no-store' }
      })
    }
    const csrf = context.cookies.get(CSRF_COOKIE)?.value ?? newCSRF()
    context.cookies.set(CSRF_COOKIE, csrf, cookieOptions(context))
    context.locals.site = {
      credential: credential!,
      review: tester
        ? {
            ...review,
            can_edit: review.can_edit && tester.role !== 'review',
            can_apply: review.can_apply && tester.role === 'publish'
          }
        : review,
      csrf,
      preview: parsePreview(context.cookies.get(CONTEXT_COOKIE)?.value)
    }
    // LIVE is normal viewing, not a second Preview mode. Clear older LIVE
    // preview cookies too, including any simulated clock stored in them.
    if (context.locals.site.preview?.view === 'LIVE') {
      context.locals.site.preview = undefined
      context.cookies.delete(CONTEXT_COOKIE, { path: '/' })
    }
  }
  if (admin && !sessionEndpoint && !context.locals.site)
    return new Response('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    })
  if (
    context.url.searchParams.has('preview') ||
    context.url.searchParams.has('now')
  ) {
    if (!context.locals.site)
      return new Response('Access denied', {
        status: 403,
        headers: { 'Cache-Control': 'private, no-store' }
      })
    const view =
      context.url.searchParams.get('preview') ??
      context.locals.site.preview?.view ??
      'LIVE'
    const now = context.url.searchParams.get('now')
    const preview = parsePreview(
      JSON.stringify({ view, ...(now && now !== 'now' ? { now } : {}) })
    )
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
    context.url.searchParams.delete('preview')
    context.url.searchParams.delete('now')
    return context.redirect(context.url.pathname + context.url.search, 303)
  }
  const response = await next()
  if (process.env.SITE_CATALOG_API_URL) {
    // Private first-slice preview; not the production cache policy.
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('X-Comfy-Content-Source', 'cms')
  }
  return response
})
