import { readFile } from 'node:fs/promises'
import type { APIRoute, APIContext } from 'astro'
import { DEMO_COOKIE } from '@/lib/cms/catalog-demo'
import {
  AUTHORING_COOKIE,
  AUTHORING_CSRF_COOKIE,
  verifyAuthoringCredential
} from '@/lib/cms/authoring-session'
import { editorFailure, editorHeaders } from '@/lib/cms/editor-server'
import { cookieOptions, newCSRF } from '@/lib/cms/admin'

export function isLocalAccess(
  context: Pick<APIContext, 'request' | 'url' | 'clientAddress'>
) {
  const headers = context.request.headers
  return (
    import.meta.env.DEV &&
    !process.env.VERCEL_ENV &&
    Boolean(process.env.SITE_CATALOG_LOCAL_AUTHORING_CREDENTIAL_FILE) &&
    ['localhost', '127.0.0.1'].includes(context.url.hostname) &&
    ![
      'forwarded',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto'
    ].some((name) => headers.has(name)) &&
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(context.clientAddress)
  )
}

export const POST: APIRoute = async (context) => {
  const fixtureFile = process.env.SITE_CATALOG_LOCAL_AUTHORING_CREDENTIAL_FILE
  if (
    !fixtureFile ||
    !isLocalAccess(context) ||
    context.request.headers.get('origin') !== context.url.origin
  )
    return new Response('Not found', { status: 404 })
  return authoringLogin(context, fixtureFile)
}
async function authoringLogin(context: APIContext, fixtureFile: string) {
  if (
    process.env.SITE_CATALOG_API_URL !== 'http://127.0.0.1:8109' ||
    context.url.search
  )
    return editorFailure(404)
  let credential: string
  try {
    credential = (await readFile(fixtureFile, 'utf8')).trim()
  } catch {
    return editorFailure(503)
  }
  const verified = await verifyAuthoringCredential(credential)
  if (!verified.ok) return verified.response
  if (
    ![
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000004'
    ].includes(verified.context.actor_uid) ||
    verified.context.owner_uid !== '00000000-0000-4000-8000-000000000001'
  )
    return editorFailure(403)
  context.cookies.set(AUTHORING_COOKIE, credential, cookieOptions(context))
  context.cookies.delete(DEMO_COOKIE, { path: '/' })
  context.cookies.set(AUTHORING_CSRF_COOKIE, newCSRF(), cookieOptions(context))
  const response = context.redirect('/admin/catalog', 303)
  for (const [name, value] of Object.entries(editorHeaders))
    response.headers.set(name, value)
  return response
}
