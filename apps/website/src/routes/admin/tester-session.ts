import type { APIRoute } from 'astro'
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  CONTEXT_COOKIE,
  cookieOptions,
  newCSRF,
  validMutation,
  verifySiteSession
} from '@/lib/cms/admin'
import {
  TESTER_COOKIE,
  localCredential,
  redeemInvitation,
  testersEnabled
} from '@/lib/cms/testers'

export const POST: APIRoute = async (context) => {
  if (!testersEnabled()) return new Response('Not found', { status: 404 })
  const body = await context.request.formData()
  if (!validMutation(context, body.get('csrf')))
    return new Response('Access denied', { status: 403 })
  const parent = await localCredential()
  if (!parent || !(await verifySiteSession(parent.credential)))
    return new Response('Sign-in temporarily unavailable', { status: 503 })
  const code = body.get('code')
  const token =
    typeof code === 'string'
      ? await redeemInvitation(code).catch(() => undefined)
      : undefined
  if (!token)
    return new Response(
      'Invitation invalid, expired, or already used. Request a new invitation.',
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
    )
  context.cookies.delete(SESSION_COOKIE, { path: '/' })
  context.cookies.delete(CONTEXT_COOKIE, { path: '/' })
  context.cookies.set(TESTER_COOKIE, token, cookieOptions(context))
  context.cookies.set(CSRF_COOKIE, newCSRF(), cookieOptions(context))
  return context.redirect('/admin/changes/', 303)
}
