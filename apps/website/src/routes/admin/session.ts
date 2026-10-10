import type { APIRoute } from 'astro'
import { TESTER_COOKIE } from '@/lib/cms/testers'
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  cookieOptions,
  newCSRF,
  verifySiteSession
} from '@/lib/cms/admin'

export const POST: APIRoute = async (context) => {
  const origin = context.request.headers.get('origin')
  if (
    !origin ||
    ![
      context.url.origin,
      ...(process.env.SITE_CATALOG_WEBSITE_ORIGINS ?? '').split(',')
    ].includes(origin)
  )
    return new Response('Access denied', { status: 403 })
  const header = context.request.headers.get('authorization') ?? ''
  const credential = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!(await verifySiteSession(credential)))
    return new Response('Access denied', {
      status: 403,
      headers: { 'Cache-Control': 'private, no-store' }
    })
  context.cookies.set(SESSION_COOKIE, credential, cookieOptions(context))
  context.cookies.set(CSRF_COOKIE, newCSRF(), cookieOptions(context))
  context.cookies.delete(TESTER_COOKIE, { path: '/' })
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'private, no-store' }
  })
}
