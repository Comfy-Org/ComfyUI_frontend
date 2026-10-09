import { readFile } from 'node:fs/promises'
import type { APIRoute, APIContext } from 'astro'
import { z } from 'astro/zod'
import { demoMode } from '@/lib/cms/demo'
import { MOCK_CREDENTIAL } from '@/lib/cms/mock-ingest'
import { TESTER_COOKIE } from '@/lib/cms/testers'
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
    Boolean(process.env.SITE_CATALOG_LOCAL_CREDENTIAL_FILE) &&
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

async function localCredential() {
  if (demoMode()) return MOCK_CREDENTIAL
  let data: unknown
  try {
    data = JSON.parse(
      await readFile(process.env.SITE_CATALOG_LOCAL_CREDENTIAL_FILE!, 'utf8')
    )
  } catch {
    return undefined
  }
  const parsed = z
    .object({
      credential: z.string(),
      expires_at: z.string().datetime({ offset: true })
    })
    .safeParse(data)
  if (!parsed.success || Date.parse(parsed.data.expires_at) <= Date.now())
    return null
  return parsed.data.credential
}

export const POST: APIRoute = async (context) => {
  if (
    !(isLocalAccess(context) || demoMode()) ||
    context.request.headers.get('origin') !== context.url.origin
  )
    return new Response('Not found', { status: 404 })
  const credential = await localCredential()
  if (credential === undefined)
    return new Response('Local review account unavailable', { status: 503 })
  if (!credential || !(await verifySiteSession(credential)))
    return new Response('Access denied', { status: 403 })
  context.cookies.set(SESSION_COOKIE, credential, cookieOptions(context))
  context.cookies.set(CSRF_COOKIE, newCSRF(), cookieOptions(context))
  context.cookies.delete(TESTER_COOKIE, { path: '/' })
  return context.redirect('/admin/', 303)
}
