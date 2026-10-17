import { createContext } from 'astro/middleware'
import { describe, expect, it, vi } from 'vitest'
import { onRequest } from './middleware'
import {
  AUTHORING_COOKIE,
  AUTHORING_CSRF_COOKIE
} from '@/lib/cms/authoring-session'
import {
  CONTEXT_COOKIE,
  CSRF_COOKIE,
  SESSION_COOKIE,
  cookieOptions,
  verifySiteSession
} from '@/lib/cms/admin'

vi.mock(import('@/lib/cms/admin'), { spy: true })

const authoringContext = {
  actor_uid: '00000000-0000-4000-8000-000000000004',
  owner_uid: '00000000-0000-4000-8000-000000000001',
  can_edit: true,
  can_apply: false,
  state: {
    live_rev: 1,
    draft_rev: 7,
    previous_live_rev: null,
    draft_generation: 2,
    next_rev: 8
  }
}

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

describe('separate catalog editor authority', () => {
  it.for([
    '/admin/content/new',
    '/admin/content-api/state',
    '/admin/content-api/delete',
    '/admin/catalog',
    '/admin/catalog/final-review',
    '/admin/catalog-api/staging',
    '/admin/catalog-api/review-receipt'
  ])(
    'authorizes %s without trusting or clearing legacy session state',
    async (path) => {
      vi.stubEnv('SITE_CATALOG_API_URL', 'http://catalog.example')
      vi.stubEnv('VERCEL_ENV', 'preview')
      vi.mocked(fetch).mockImplementation(
        vi.fn(async () => Response.json(authoringContext))
      )
      const context = contextFor(path)
      context.cookies.set(AUTHORING_COOKIE, 'private-local-fixture')
      context.cookies.set(AUTHORING_CSRF_COOKIE, 'a'.repeat(64))
      const response = await onRequest(
        context,
        async () => new Response('Editor')
      )
      expect(response?.status).toBe(200)
      expect(context.locals.catalogAuthoring?.can_edit).toBe(true)
      expect(context.locals.site).toBeUndefined()
      expect(context.cookies.get(SESSION_COOKIE)?.value).toBe(
        'expired-test-session'
      )
      expect(response?.headers.get('Cache-Control')).toBe('private, no-store')
      expect(verifySiteSession).not.toHaveBeenCalled()
    }
  )

  it('does not turn an earlier successful editor request into an authority lease', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://catalog.example')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const fetcher = vi.fn(async () => Response.json(authoringContext))
    vi.mocked(fetch).mockImplementation(fetcher)
    const context = contextFor('/admin/content/new')
    context.cookies.set(AUTHORING_COOKIE, 'private-local-fixture')
    context.cookies.set(AUTHORING_CSRF_COOKIE, 'a'.repeat(64))
    const next = vi.fn(async () => new Response('Editor'))
    expect((await onRequest(context, next))?.status).toBe(200)
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }))
    expect((await onRequest(context, next))?.status).toBe(403)
    expect(next).toHaveBeenCalledOnce()
  })

  it('does not read authoring cookies on public discovery routes', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://catalog.example')
    const fetcher = vi.fn()
    vi.mocked(fetch).mockImplementation(fetcher)
    const context = contextFor('/api/v1/catalog/docs')
    context.cookies.set(AUTHORING_COOKIE, 'expired-local-fixture')
    context.cookies.set(AUTHORING_CSRF_COOKIE, 'a'.repeat(64))
    const response = await onRequest(context, async () => new Response('Docs'))
    expect(response?.status).toBe(200)
    expect(context.locals.catalogAuthoring).toBeUndefined()
    expect(fetcher).not.toHaveBeenCalled()
    expect(verifySiteSession).not.toHaveBeenCalled()
  })
})

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
    '/agents',
    '/openapi.json',
    '/api/v1/catalog/agents',
    '/api/v1/catalog/openapi.json',
    '/api/v1/catalog/docs',
    '/api/v1/catalog/docs/?preview=DRAFT&now=2030-01-01'
  ])('serves public documentation %s despite a stale session', async (path) => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    const context = contextFor(path)
    const next = vi.fn(() => Promise.resolve(new Response('Documentation')))
    const response = await onRequest(context, next)
    expect(response?.status).toBe(200)
    expect(next).toHaveBeenCalledOnce()
    expect(verifySiteSession).not.toHaveBeenCalled()
    expect(context.locals.site).toBeUndefined()
    expect(context.cookies.get(CONTEXT_COOKIE)?.value).toBe('test-preview')
    expect(response?.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it.for([
    ['/api/v1/catalog/docs', 'POST'],
    ['/api/v1/catalog/state', 'GET'],
    ['/api/v1/catalog/docs-not-public', 'GET']
  ])(
    'does not broaden documentation exemption to %s %s',
    async ([path, method]) => {
      vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
      vi.mocked(verifySiteSession).mockResolvedValue(undefined)
      const next = vi.fn(() => Promise.resolve(new Response('Private')))
      const response = await onRequest(contextFor(path, method), next)
      expect(response?.status).toBe(403)
      expect(next).not.toHaveBeenCalled()
    }
  )

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

  function noSession(demo: string) {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubEnv('SITE_CATALOG_DEMO', demo)
    vi.stubEnv('VERCEL_ENV', 'preview')
    return createContext({
      request: new Request('http://127.0.0.1:4329/admin'),
      defaultLocale: 'en',
      clientAddress: '127.0.0.1'
    })
  }

  it('sends a demo visitor without a session to the demo entry', async () => {
    const next = vi.fn(() => Promise.resolve(new Response('Admin')))
    const response = await onRequest(noSession('1'), next)
    expect(response?.status).toBe(303)
    expect(response?.headers.get('Location')).toBe('/admin/local-access')
    expect(next).not.toHaveBeenCalled()
  })

  it('keeps the admin hidden from visitors without a session outside the demo', async () => {
    const next = vi.fn(() => Promise.resolve(new Response('Admin')))
    const response = await onRequest(noSession(''), next)
    expect(response?.status).toBe(404)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('provider bypass on the complete CMS middleware chain', () => {
  it.for(['/hub/models/', '/hub/workflows/?preview=DRAFT', '/?now=now'])(
    'does not run CMS middleware on a production request to %s',
    async (path) => {
      vi.stubEnv('SITE_CATALOG_API_URL', 'https://catalog.example')
      vi.stubEnv('VERCEL_ENV', 'production')
      const fetcher = vi.fn<typeof fetch>()
      vi.mocked(fetch).mockImplementation(fetcher)
      const context = contextFor(path)
      context.cookies.set(AUTHORING_COOKIE, 'expired-fixture')
      const original = new Response('Existing site', {
        headers: {
          'Cache-Control': 'public, max-age=60',
          'CDN-Cache-Control': 'public, max-age=3600'
        }
      })
      const next = vi.fn(async () => original)
      const response = await onRequest(context, next)
      expect(response).toBe(original)
      expect(next).toHaveBeenCalledOnce()
      expect(response?.headers.get('Cache-Control')).toBe('public, max-age=60')
      expect(response?.headers.has('X-Comfy-Content-Source')).toBe(false)
      expect(response?.headers.has('X-Robots-Tag')).toBe(false)
      expect(response?.headers.has('Location')).toBe(false)
      expect(context.cookies.get(SESSION_COOKIE)?.value).toBe(
        'expired-test-session'
      )
      expect(fetcher).not.toHaveBeenCalled()
      expect(verifySiteSession).not.toHaveBeenCalled()
    }
  )
  it.for(['/admin/content/new', '/admin/catalog-api/staging'])(
    'covers early authorization refusal for %s',
    async (path) => {
      vi.stubEnv('SITE_CATALOG_API_URL', 'http://catalog.example')
      vi.stubEnv('VERCEL_ENV', 'preview')
      vi.mocked(fetch).mockImplementation(
        vi.fn(async () => new Response(null, { status: 403 }))
      )
      const context = contextFor(path)
      context.cookies.set(AUTHORING_COOKIE, 'fixture')
      context.cookies.set(AUTHORING_CSRF_COOKIE, 'a'.repeat(64))
      const next = vi.fn(async () => new Response('Must not run'))
      const response = await onRequest(context, next)
      expect(response?.status).toBe(403)
      expect(next).not.toHaveBeenCalled()
      expect(response?.headers.get('Vercel-CDN-Cache-Control')).toBe('no-store')
      expect(response?.headers.get('Cloudflare-CDN-Cache-Control')).toBe(
        'no-store'
      )
      expect(response?.headers.get('X-Comfy-Content-Source')).toBe('cms')
    }
  )

  it('leaves provider policy unchanged when CMS is disabled', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', '')
    const context = contextFor('/hub/models/')
    const response = await onRequest(
      context,
      async () =>
        new Response('Existing site', {
          headers: { 'CDN-Cache-Control': 'public, max-age=3600' }
        })
    )
    expect(response?.headers.get('CDN-Cache-Control')).toBe(
      'public, max-age=3600'
    )
    expect(response?.headers.has('X-Comfy-Content-Source')).toBe(false)
  })

  it('does not activate the new cache policy in production even with a catalog URL', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'https://catalog.example')
    vi.stubEnv('VERCEL_ENV', 'production')
    const response = await onRequest(
      contextFor('/api/v1/catalog/docs'),
      async () =>
        new Response('Existing response', {
          headers: { 'CDN-Cache-Control': 'public, max-age=3600' }
        })
    )
    expect(response?.status).toBe(200)
    expect(response?.headers.get('CDN-Cache-Control')).toBe(
      'public, max-age=3600'
    )
    expect(response?.headers.has('Vercel-CDN-Cache-Control')).toBe(false)
    expect(response?.headers.has('Cloudflare-CDN-Cache-Control')).toBe(false)
  })
})

describe('robots header on CMS responses', () => {
  const review = {
    draft: { revision_id: 2, generation: 1, items: [] },
    live: { revision_id: 1, generation: 1, items: [] },
    can_edit: true,
    can_apply: false,
    history: []
  }
  function anonymous(path: string) {
    return createContext({
      request: new Request(`http://127.0.0.1:4329${path}`),
      defaultLocale: 'en',
      clientAddress: '127.0.0.1'
    })
  }
  const page = () => Promise.resolve(new Response('Detail'))

  it('keeps every CMS page out of search in a non-indexable build', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const response = await onRequest(anonymous('/hub/workflows/example/'), page)
    expect(response?.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  })

  it('leaves an anonymous LIVE page to its own robots meta in an indexable build', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('WEBSITE_INDEXABLE', '1')
    const response = await onRequest(anonymous('/hub/workflows/example/'), page)
    expect(response?.headers.has('X-Robots-Tag')).toBe(false)
    expect(response?.headers.get('X-Comfy-Content-Source')).toBe('cms')
  })

  it('keeps a staff view out of search even in an indexable build', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('WEBSITE_INDEXABLE', '1')
    vi.mocked(verifySiteSession).mockResolvedValue(review)
    const context = contextFor('/hub/workflows/example/')
    const response = await onRequest(context, page)
    expect(context.locals.site).toBeDefined()
    expect(response?.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  })
})
