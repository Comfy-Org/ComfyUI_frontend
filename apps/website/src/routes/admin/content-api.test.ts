// @vitest-environment node
import { createContext } from 'astro/middleware'
import { describe, expect, it, vi } from 'vitest'
import { AUTHORING_CSRF_COOKIE } from '@/lib/cms/authoring-session'
import { GET, POST } from './content-api'

const uid = '00000000-0000-4000-8000-000000000001'
const csrf = 'a'.repeat(64)
function context(
  operation: string,
  options: {
    method?: string
    body?: string | FormData
    origin?: string
    query?: string
    edit?: boolean
    anonymous?: boolean
    length?: string
  } = {}
) {
  const method = options.method ?? 'POST'
  const request = new Request(
    `https://website.example/admin/content-api/${operation}${options.query ?? ''}`,
    {
      method,
      body: options.body,
      headers: {
        Origin: options.origin ?? 'https://website.example',
        'X-Comfy-CSRF': csrf,
        'Idempotency-Key': 'test-retry-key',
        ...(typeof options.body === 'string'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(options.length ? { 'Content-Length': options.length } : {})
      }
    }
  )
  const ctx = createContext({
    request,
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  ctx.params.operation = operation
  ctx.cookies.set(AUTHORING_CSRF_COOKIE, csrf)
  if (!options.anonymous)
    ctx.locals.catalogAuthoring = {
      credential: 'server-only-fixture',
      csrf,
      actor_uid: uid,
      owner_uid: uid,
      can_edit: options.edit ?? true,
      can_apply: false,
      state: {
        draft_rev: 2,
        live_rev: 1,
        next_rev: 3,
        draft_generation: 1,
        previous_live_rev: null
      }
    }
  return ctx
}
function upstream(status = 200, body: unknown = { uid }) {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://catalog.example')
  vi.stubEnv('VERCEL_ENV', 'preview')
  const fetcher = vi.fn().mockResolvedValue(Response.json(body, { status }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('staff content proxy', () => {
  it('forwards literal JSON keys without record-parser data loss or prototype mutation', async () => {
    const fetcher = upstream()
    const payload =
      '{"__proto__":{"literal":true},"inputs":{"mode":{"optionLabels":{"__proto__":"Literal"}}}}'
    const response = await POST(context('save', { body: payload }))
    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0][1].body).toBe(payload)
    expect(Object.hasOwn(Object.prototype, 'literal')).toBe(false)
  })
  it.each([{ anonymous: true }, { edit: false }])(
    'hides authoring from unauthorized accounts',
    async (options) => {
      const fetcher = upstream()
      expect(
        (await POST(context('save', { ...options, body: '{}' }))).status
      ).toBe(404)
      expect(fetcher).not.toHaveBeenCalled()
    }
  )
  it('rejects cross-origin mutations before upstream authorization', async () => {
    const fetcher = upstream()
    expect(
      (
        await POST(
          context('save', { origin: 'https://evil.example', body: '{}' })
        )
      ).status
    ).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects bodies over the limit before contacting the backend', async () => {
    const fetcher = upstream()
    expect(
      (
        await POST(
          context('save', { length: String((1 << 20) + 1), body: '{}' })
        )
      ).status
    ).toBe(413)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('forwards complete JSON, CAS and idempotency; credentials never return to the browser', async () => {
    const fetcher = upstream()
    const payload = {
      uid,
      title: 'Updated',
      expected_draft_rev: 7,
      expected_revision_uid: uid,
      examples: [{ values: { prompt: 'keep' } }]
    }
    const response = await POST(
      context('save', { body: JSON.stringify(payload) })
    )
    expect(fetcher).toHaveBeenCalledOnce()
    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe(
      `http://catalog.example/api/v1/catalog/draft/items/${uid}`
    )
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({
      title: payload.title,
      expected_draft_rev: 7,
      expected_revision_uid: uid,
      examples: payload.examples
    })
    expect(init.headers.get('Authorization')).toBe('Bearer server-only-fixture')
    expect(init.headers.get('Idempotency-Key')).toBe('test-retry-key')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(response.headers.has('Authorization')).toBe(false)
    expect(await response.json()).toEqual({ uid })
  })
  it('creates new content through POST rather than replacing another resource', async () => {
    const fetcher = upstream()
    await POST(
      context('save', {
        body: JSON.stringify({ title: 'New', expected_draft_rev: 7 })
      })
    )
    expect(fetcher.mock.calls[0][1].method).toBe('POST')
  })
  it('does not treat a legacy UI grant as backend edit authorization', async () => {
    upstream(403, { message: 'permission required' })
    expect((await POST(context('save', { body: '{}' }))).status).toBe(403)
  })
  it('passes structured conflicts through unchanged', async () => {
    const details = {
      field_errors: [{ path: '$.title', message: 'stale record' }]
    }
    upstream(409, details)
    const response = await POST(context('save', { body: '{}' }))
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(details)
  })
  it.each([
    '?uid=not-a-uid',
    `?uid=${uid}&uid=${uid}`,
    `?uid=${uid}&path=/etc/passwd`
  ])('rejects unbounded/invalid query paths: %s', async (query) => {
    const fetcher = upstream()
    expect((await GET(context('item', { method: 'GET', query }))).status).toBe(
      400
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('reads current Draft without writing a no-op version', async () => {
    const fetcher = upstream()
    expect(
      (await GET(context('item', { method: 'GET', query: `?uid=${uid}` })))
        .status
    ).toBe(200)
    expect(fetcher.mock.calls[0][1].method).toBeUndefined()
  })
  it('rewrites only the media replacement envelope', async () => {
    const fetcher = upstream()
    const form = new FormData()
    form.set('file', new Blob(['png'], { type: 'image/png' }), 'sample.png')
    for (const [key, value] of Object.entries({
      media_uid: uid,
      name: 'sample.png',
      expected_draft_rev: '7',
      expected_revision_uid: uid,
      originating_entity_uid: uid,
      role: 'hero'
    }))
      form.set(key, value)
    expect((await POST(context('upload', { body: form }))).status).toBe(200)
    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe(
      `http://catalog.example/api/v1/catalog/draft/media/${uid}/file`
    )
    expect(init.method).toBe('PUT')
    expect([...init.body.keys()]).toEqual([
      'file',
      'name',
      'expected_draft_rev',
      'expected_revision_uid'
    ])
  })
  it('rejects duplicate multipart fields', async () => {
    const fetcher = upstream()
    const form = new FormData()
    form.append('name', 'one')
    form.append('name', 'two')
    expect((await POST(context('upload', { body: form }))).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('forwards videos larger than the previous 8 MiB cap, retaining private authorization', async () => {
    const fetcher = upstream()
    const form = new FormData()
    form.set(
      'file',
      new Blob([new Uint8Array(9 << 20)], { type: 'video/mp4' }),
      'clip.mp4'
    )
    form.set('name', 'clip.mp4')
    form.set('expected_draft_rev', '7')
    form.set('originating_entity_uid', uid)
    form.set('role', 'hero')
    expect((await POST(context('upload', { body: form }))).status).toBe(200)
    const forwarded = fetcher.mock.calls[0][1].body.get('file')
    expect(forwarded.size).toBe(9 << 20)
    expect(forwarded.type).toBe('video/mp4')
  })
  it('fails closed when upstream returns an unexpected document', async () => {
    const fetcher = upstream()
    fetcher.mockResolvedValue(
      new Response('<html>login</html>', { status: 200 })
    )
    expect((await POST(context('save', { body: '{}' }))).status).toBe(503)
  })
})
