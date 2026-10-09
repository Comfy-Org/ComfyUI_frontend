// Exercise the server's HTTP request implementation, not happy-dom's browser
// Request, which strips the Origin header before the handler can validate it.
// @vitest-environment node
import { createContext } from 'astro/middleware'
import type { ContentCatalogReview } from '@comfyorg/ingest-types'
import { describe, expect, it, vi } from 'vitest'
import { POST } from './actions'
import { CONTEXT_COOKIE, CSRF_COOKIE } from '@/lib/cms/admin'

const review: ContentCatalogReview = {
  draft: { revision_id: 2, generation: 1, items: [] },
  live: { revision_id: 1, generation: 1, items: [] },
  can_edit: true,
  can_apply: false,
  history: []
}

describe('Preview controls', () => {
  it.for(['preview', 'exit'])(
    '%s returns to real-time LIVE without Preview',
    async (action) => {
      vi.stubEnv('SITE_CATALOG_WEBSITE_ORIGINS', 'https://preview.example')
      const csrf = 'a'.repeat(64)
      const context = createContext({
        request: new Request('https://preview.example/admin/actions', {
          method: 'POST',
          headers: {
            Origin: 'https://preview.example',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            csrf,
            action,
            view: 'LIVE',
            now: '2026-10-15T16:00:00Z'
          }).toString()
        }),
        defaultLocale: 'en',
        clientAddress: '127.0.0.1'
      })
      context.cookies.set(CSRF_COOKIE, csrf)
      context.cookies.set(
        CONTEXT_COOKIE,
        JSON.stringify({ view: 'DRAFT', now: '2026-10-15T16:00:00Z' })
      )
      context.locals.site = {
        credential: 'test-only',
        review,
        csrf,
        preview: { view: 'DRAFT', now: '2026-10-15T16:00:00Z' }
      }
      expect(context.request.headers.get('origin')).toBe(
        'https://preview.example'
      )
      expect(context.cookies.get(CSRF_COOKIE)?.value).toBe(csrf)
      expect((await context.request.clone().formData()).get('csrf')).toBe(csrf)
      const response = await POST(context)
      expect(response.status).toBe(303)
      expect(response.headers.get('Location')).toBe('/hub/models/')
      expect(context.cookies.has(CONTEXT_COOKIE)).toBe(false)
    }
  )
})

function adminPost(
  fields: ReadonlyArray<readonly [string, string]>,
  canApply = true
) {
  vi.stubEnv('SITE_CATALOG_API_URL', 'https://ingest.example')
  vi.stubEnv('SITE_CATALOG_WEBSITE_ORIGINS', 'https://preview.example')
  const csrf = 'b'.repeat(64)
  const context = createContext({
    request: new Request('https://preview.example/admin/actions', {
      method: 'POST',
      headers: {
        Origin: 'https://preview.example',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams([
        ['csrf', csrf],
        ...fields.map(([key, value]) => [key, value])
      ]).toString()
    }),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  context.cookies.set(CSRF_COOKIE, csrf)
  context.locals.site = {
    credential: 'test-only',
    review: { ...review, can_apply: canApply },
    csrf
  }
  const upstream = vi
    .fn<typeof fetch>()
    .mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 }))
    )
  vi.stubGlobal('fetch', upstream)
  const calls = () =>
    upstream.mock.calls.map(([url, init]) => [
      new URL(String(url)).pathname,
      JSON.parse(String(init?.body))
    ])
  return { response: POST(context), calls }
}

describe('Draft publication', () => {
  it('approves the included workflows before publishing the draft', async () => {
    const { response, calls } = adminPost([
      ['action', 'publish'],
      ['confirm', 'yes'],
      ['draft_id', '2'],
      ['generation', '1'],
      ['approve', 'shr_a:v3'],
      ['approve', 'shr_b:v1']
    ])
    expect((await response).headers.get('Location')).toBe('/admin/history/')
    expect(calls()).toEqual([
      [
        '/admin/api/site/submissions/shr_a/review',
        { version_id: 'v3', status: 'approved' }
      ],
      [
        '/admin/api/site/submissions/shr_b/review',
        { version_id: 'v1', status: 'approved' }
      ],
      ['/admin/api/site/publish', { draft_id: 2, generation: 1 }]
    ])
  })

  it('rejects several workflows in one action', async () => {
    const { response, calls } = adminPost([
      ['action', 'reject'],
      ['confirm', 'yes'],
      ['submission', 'shr_a:v3'],
      ['submission', 'shr_b:v1']
    ])
    expect((await response).headers.get('Location')).toBe('/admin/')
    expect(calls().map(([path]) => path)).toEqual([
      '/admin/api/site/submissions/shr_a/review',
      '/admin/api/site/submissions/shr_b/review'
    ])
  })

  it.for([
    ['a malformed workflow reference', [['approve', '../publish:v1']]],
    ['a rejection without workflows', []]
  ] as const)('refuses %s', async ([, extra]) => {
    const action = extra.length ? 'publish' : 'reject'
    const { response, calls } = adminPost([
      ['action', action],
      ['confirm', 'yes'],
      ...extra
    ])
    expect((await response).status).toBe(400)
    expect(calls()).toEqual([])
  })

  it('needs the apply permission', async () => {
    const { response, calls } = adminPost(
      [
        ['action', 'publish'],
        ['confirm', 'yes']
      ],
      false
    )
    expect((await response).status).toBe(403)
    expect(calls()).toEqual([])
  })
})

describe('Preview return path', () => {
  it.for([
    ['/hub/models/wan/', '/hub/models/wan/'],
    ['//evil.example/', '/hub/models/'],
    ['https://evil.example/', '/hub/models/']
  ])('returns to %s as %s', async ([target, location]) => {
    const { response } = adminPost([
      ['action', 'now'],
      ['view', 'DRAFT'],
      ['return_to', target]
    ])
    expect((await response).headers.get('Location')).toBe(location)
  })
})
