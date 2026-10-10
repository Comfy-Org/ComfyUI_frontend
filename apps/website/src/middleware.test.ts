import { createContext } from 'astro/middleware'
import { describe, expect, it, vi } from 'vitest'
import { onRequest } from './middleware'
import {
  CONTEXT_COOKIE,
  CSRF_COOKIE,
  SESSION_COOKIE,
  cookieOptions,
  verifySiteSession
} from '@/lib/cms/admin'

vi.mock(import('@/lib/cms/admin'), { spy: true })

function contextFor(path: string, method = 'GET') {
  const context = createContext({
    request: new Request(`http://127.0.0.1:4329${path}`, {
      method
    }),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  context.cookies.set(SESSION_COOKIE, 'expired-test-session', { path: '/' })
  context.cookies.set(CONTEXT_COOKIE, 'test-preview', { path: '/' })
  context.cookies.set(CSRF_COOKIE, 'test-csrf', { path: '/' })
  return context
}

describe('expired staff sessions', () => {
  it.for([false, true])(
    'local entry respects forwarded=%s',
    async (forwarded) => {
      vi.stubEnv('DEV', true)
      vi.stubEnv('VERCEL_ENV', '')
      vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
      vi.stubEnv(
        'SITE_CATALOG_LOCAL_CREDENTIAL_FILE',
        '/private/local-credential.json'
      )
      const context = createContext({
        request: new Request('http://127.0.0.1:4329/hub/models/', {
          headers: forwarded ? { 'X-Forwarded-For': '203.0.113.1' } : {}
        }),
        defaultLocale: 'en',
        clientAddress: '127.0.0.1'
      })
      await onRequest(context, () => Promise.resolve(new Response('Hub')))
      expect(context.locals.siteLocalAccess).toBe(!forwarded)
      expect(context.locals.site).toBeUndefined()
    }
  )

  it.for([
    ['/admin/local-access', 'GET'],
    ['/admin/local-session', 'POST'],
    ['/admin/session', 'POST']
  ])(
    'allows recovery at %s %s without trusting the stale session',
    async ([path, method]) => {
      vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
      const context = contextFor(path, method)
      const next = vi.fn(() =>
        Promise.resolve(new Response('Sign-in endpoint'))
      )
      const response = await onRequest(context, next)
      expect(response?.status).toBe(200)
      expect(context.locals.site).toBeUndefined()
      expect(verifySiteSession).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledOnce()
    }
  )

  it('denies protected content and clears all stale session cookies', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.mocked(verifySiteSession).mockResolvedValue(undefined)
    const context = contextFor('/admin/changes/')
    const next = vi.fn(() => Promise.resolve(new Response('Protected content')))
    const response = await onRequest(context, next)
    expect(response?.status).toBe(403)
    expect(next).not.toHaveBeenCalled()
    expect(context.locals.site).toBeUndefined()
    for (const name of [SESSION_COOKIE, CONTEXT_COOKIE, CSRF_COOKIE])
      expect(context.cookies.has(name)).toBe(false)
  })

  it.for([
    {
      dev: true,
      hosted: '',
      helper: '/private/local-credential.json',
      hours: 168
    },
    {
      dev: true,
      hosted: 'preview',
      helper: '/private/local-credential.json',
      hours: 8
    },
    {
      dev: false,
      hosted: '',
      helper: '/private/local-credential.json',
      hours: 8
    },
    { dev: true, hosted: '', helper: '', hours: 8 }
  ])(
    'bounds session lifetime for $hours-hour mode',
    ({ dev, hosted, helper, hours }) => {
      vi.stubEnv('DEV', dev)
      vi.stubEnv('VERCEL_ENV', hosted)
      vi.stubEnv('SITE_CATALOG_LOCAL_CREDENTIAL_FILE', helper)
      expect(cookieOptions(contextFor('/admin/')).maxAge).toBe(hours * 60 * 60)
    }
  )
})
