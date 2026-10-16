import { readFile } from 'node:fs/promises'
import type { APIRoute, APIContext } from 'astro'
import { z } from 'astro/zod'
import { demoMode, newDemoCredential } from '@/lib/cms/demo'
import { TESTER_COOKIE } from '@/lib/cms/testers'
import { DEMO_COOKIE } from '@/lib/cms/catalog-demo'
import {
  AUTHORING_COOKIE,
  AUTHORING_CSRF_COOKIE,
  verifyAuthoringCredential
} from '@/lib/cms/authoring-session'
import { editorFailure, editorHeaders } from '@/lib/cms/editor-server'
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  cookieOptions,
  newCSRF,
  verifySiteSession
} from '@/lib/cms/admin'

export function isLocalAccess(
  context: Pick<APIContext, 'request' | 'url' | 'clientAddress'>
) {
  const headers = context.request.headers
  return (
    import.meta.env.DEV &&
    !process.env.VERCEL_ENV &&
    Boolean(
      process.env.SITE_CATALOG_LOCAL_CREDENTIAL_FILE ||
      process.env.SITE_CATALOG_LOCAL_AUTHORING_CREDENTIAL_FILE
    ) &&
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
  if (
    !(isLocalAccess(context) || demoMode()) ||
    context.request.headers.get('origin') !== context.url.origin
  )
    return new Response('Not found', { status: 404 })
  if (demoMode()) return demoLogin(context)
  const fixtureFile = process.env.SITE_CATALOG_LOCAL_AUTHORING_CREDENTIAL_FILE
  return fixtureFile
    ? authoringLogin(context, fixtureFile)
    : reviewLogin(context)
}
async function demoLogin(context: APIContext) {
  const credential = newDemoCredential()
  if (!(await verifySiteSession(credential))) return editorFailure(403)
  context.cookies.set(SESSION_COOKIE, credential, cookieOptions(context))
  context.cookies.set(CSRF_COOKIE, newCSRF(), cookieOptions(context))
  context.cookies.delete(TESTER_COOKIE, { path: '/' })
  return context.redirect('/admin/', 303)
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
async function reviewLogin(context: APIContext) {
  let data: unknown
  try {
    data = JSON.parse(
      await readFile(process.env.SITE_CATALOG_LOCAL_CREDENTIAL_FILE!, 'utf8')
    )
  } catch {
    return new Response('Local review account unavailable', { status: 503 })
  }
  const parsed = z
    .object({
      credential: z.string(),
      expires_at: z.string().datetime({ offset: true })
    })
    .safeParse(data)
  if (
    !parsed.success ||
    Date.parse(parsed.data.expires_at) <= Date.now() ||
    !(await verifySiteSession(parsed.data.credential))
  )
    return new Response('Access denied', { status: 403 })
  context.cookies.set(
    SESSION_COOKIE,
    parsed.data.credential,
    cookieOptions(context)
  )
  context.cookies.set(CSRF_COOKIE, newCSRF(), cookieOptions(context))
  context.cookies.delete(TESTER_COOKIE, { path: '/' })
  return context.redirect('/admin/', 303)
}
