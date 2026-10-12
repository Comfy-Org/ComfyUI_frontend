import type { APIRoute } from 'astro'
import { cookieOptions, newCSRF } from '@/lib/cms/admin'
import {
  AUTHORING_COOKIE,
  AUTHORING_CSRF_COOKIE,
  validAuthoringMutation,
  validAuthoringOrigin,
  verifyAuthoringCredential
} from '@/lib/cms/authoring-session'
import { editorFailure, editorHeaders } from '@/lib/cms/editor-server'
import { DEMO_COOKIE } from '@/lib/cms/catalog-demo'

// Explicit bearer exchange; no anonymous/demo bypass, credential input form,
// cookie mint on GET, or acceptance of the old review facade as CCC authority.
export const POST: APIRoute = async (context) => {
  if (context.url.search || !validAuthoringOrigin(context))
    return editorFailure(403)
  const authorization = context.request.headers.get('Authorization') ?? ''
  const credential = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : ''
  const verified = await verifyAuthoringCredential(credential)
  if (!verified.ok) return verified.response
  const options = { ...cookieOptions(context), maxAge: 8 * 60 * 60 }
  context.cookies.set(AUTHORING_COOKIE, credential, options)
  context.cookies.delete(DEMO_COOKIE, { path: '/' })
  context.cookies.set(AUTHORING_CSRF_COOKIE, newCSRF(), options)
  return new Response(null, { status: 204, headers: editorHeaders })
}

export const DELETE: APIRoute = async (context) => {
  if (context.url.search || !validAuthoringMutation(context))
    return editorFailure(403)
  context.cookies.delete(AUTHORING_COOKIE, { path: '/' })
  context.cookies.delete(DEMO_COOKIE, { path: '/' })
  context.cookies.delete(AUTHORING_CSRF_COOKIE, { path: '/' })
  return new Response(null, { status: 204, headers: editorHeaders })
}
