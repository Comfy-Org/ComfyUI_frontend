// @vitest-environment node
import { createContext } from 'astro/middleware'
import { describe, expect, it, vi } from 'vitest'
import { AUTHORING_CSRF_COOKIE } from '@/lib/cms/authoring-session'
import { CONTEXT_COOKIE } from '@/lib/cms/admin'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import { stagePayload, discardPayload } from '@/lib/cms/staging-review'
import { GET, POST } from './catalog-api'

function context(
  operation: string,
  options: {
    method?: string
    apply?: boolean
    anonymous?: boolean
    origin?: string
    query?: string
    body?: unknown
  } = {}
) {
  const ctx = createContext({
    request: new Request(
      `https://website.example/admin/catalog-api/${operation}${options.query ?? ''}`,
      {
        method: options.method ?? 'POST',
        headers: {
          Origin: options.origin ?? 'https://website.example',
          'X-Comfy-CSRF': 'a'.repeat(64),
          'Idempotency-Key': 'review-fixture-key',
          'Content-Type': 'application/json'
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body)
      }
    ),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  ctx.params.operation = operation
  ctx.cookies.set(AUTHORING_CSRF_COOKIE, 'a'.repeat(64))
  if (!options.anonymous)
    ctx.locals.catalogAuthoring = {
      csrf: 'a'.repeat(64),
      credential: 'server-only-fixture',
      actor_uid: '00000000-0000-4000-8000-000000000004',
      owner_uid: '00000000-0000-4000-8000-000000000001',
      can_edit: true,
      can_apply: options.apply ?? true,
      state: fixtureReview().state
    }
  return ctx
}
function backend(status = 200, body: unknown = fixtureReview()) {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://catalog.example')
  vi.stubEnv('VERCEL_ENV', 'preview')
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json(body, { status })
  )
  vi.mocked(fetch).mockImplementation(fetcher)
  return fetcher
}
describe('catalog staging same-origin facade', () => {
  it('forwards read-only checked review with CSRF but no mutation retry key', async () => {
    const r = fixtureReview()
    const final = {
      state: r.state,
      changes: r.items,
      deferred: [],
      selection_digest: 'b'.repeat(64),
      publish_enabled: true
    }
    const fetcher = backend(200, final)
    const body = {
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      selected_uids: [r.items[0].content.uid]
    }
    const ctx = context('final-review', { body })
    ctx.request.headers.delete('Idempotency-Key')
    const response = await POST(ctx)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(final)
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      'http://catalog.example/api/v1/catalog/draft/final-review'
    )
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual(body)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('does not forward checked review from an unauthorized account or cross-origin request', async () => {
    const fetcher = backend()
    const body = {
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      selected_uids: [fixtureReview().items[0].content.uid]
    }
    expect(
      (await POST(context('final-review', { body, apply: false }))).status
    ).toBe(404)
    expect(
      (
        await POST(
          context('final-review', { body, origin: 'https://evil.example' })
        )
      ).status
    ).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.for([
    [],
    null,
    ['bad'],
    [
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000010'
    ]
  ])(
    'refuses invalid checked review selection %j before forwarding',
    async (selected_uids) => {
      const fetcher = backend()
      const body = {
        review: {
          expected_live_rev: 1,
          expected_draft_rev: 7,
          expected_draft_generation: 5
        },
        selected_uids
      }
      expect((await POST(context('final-review', { body }))).status).toBe(400)
      expect(fetcher).not.toHaveBeenCalled()
    }
  )
  it('preserves the checked IDs in publication instead of stripping them to the legacy body', async () => {
    const state = {
      ...fixtureReview().state,
      live_rev: 7,
      draft_rev: 8,
      next_rev: 9,
      previous_live_rev: 1,
      draft_generation: 0
    }
    const fetcher = backend(200, state)
    const body = {
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      expected_selection_digest: 'b'.repeat(64),
      selected_uids: [fixtureReview().items[0].content.uid]
    }
    expect((await POST(context('publish', { body }))).status).toBe(200)
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual(body)
  })
  it('requires publisher authority and CSRF for temporary publication', async () => {
    const r = fixtureReview()
    const payload = {
      review: {
        expected_live_rev: r.state.live_rev,
        expected_draft_rev: r.state.draft_rev,
        expected_draft_generation: r.state.draft_generation
      },
      expected_selection_digest: r.selection_digest
    }
    const state = {
      ...r.state,
      live_rev: 7,
      draft_rev: 8,
      next_rev: 9,
      previous_live_rev: 1,
      draft_generation: 0
    }
    const fetcher = backend(200, state)
    expect(
      (await POST(context('publish', { apply: false, body: payload }))).status
    ).toBe(404)
    expect(
      (
        await POST(
          context('publish', { origin: 'https://evil.example', body: payload })
        )
      ).status
    ).toBe(403)
    expect(
      (
        await POST(
          context('publish', { body: { ...payload, publish_enabled: true } })
        )
      ).status
    ).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
    const response = await POST(context('publish', { body: payload }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(state)
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      'http://catalog.example/api/v1/catalog/draft/publish'
    )
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('requires edit, not apply, for explicit discard and preserves dependency errors', async () => {
    const initial = fixtureReview()
    const payload = discardPayload(
      initial,
      initial.items.map((item) => item.content.uid)
    )
    const fetcher = backend(422, {
      field_errors: [{ path: '$.workflow_uid', message: 'Missing target' }]
    })
    const response = await POST(
      context('discard-changes', { apply: false, body: payload })
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      field_errors: [{ path: '$.workflow_uid', message: 'Missing target' }]
    })
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      'http://catalog.example/api/v1/catalog/draft/discard-changes'
    )
    const applyOnly = context('discard-changes', { body: payload })
    if (applyOnly.locals.catalogAuthoring)
      applyOnly.locals.catalogAuthoring.can_edit = false
    expect((await POST(applyOnly)).status).toBe(404)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('rejects discard without confirmation, duplicate exact targets, unknown fields or cross-origin', async () => {
    const initial = fixtureReview()
    const payload = discardPayload(
      initial,
      initial.items.map((item) => item.content.uid)
    )
    const fetcher = backend()
    for (const body of [
      { ...payload, confirm_discard: false },
      { ...payload, targets: [] },
      { ...payload, targets: [...payload.targets, ...payload.targets] },
      { ...payload, query: '$.title' }
    ]) {
      expect((await POST(context('discard-changes', { body }))).status).toBe(
        400
      )
    }
    expect(
      (
        await POST(
          context('discard-changes', {
            body: payload,
            origin: 'https://evil.example'
          })
        )
      ).status
    ).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.for([{ anonymous: true }, { apply: false }])(
    'refuses unauthorized staging mutations',
    async (options) => {
      const fetcher = backend()
      expect(
        (
          await POST(
            context('staging', {
              ...options,
              body: stagePayload(fixtureReview(), 'APPROVED', true)
            })
          )
        ).status
      ).toBe(404)
      expect(fetcher).not.toHaveBeenCalled()
    }
  )
  it('rejects cross-origin, arbitrary query and unsupported JSON before contacting the backend', async () => {
    const fetcher = backend()
    expect(
      (await POST(context('staging', { origin: 'https://evil.example' })))
        .status
    ).toBe(403)
    expect(
      (await GET(context('staging', { method: 'GET', query: '?json_path=x' })))
        .status
    ).toBe(400)
    expect(
      (
        await POST(
          context('staging', {
            body: {
              ...stagePayload(fixtureReview(), 'APPROVED', true),
              extra: true
            }
          })
        )
      ).status
    ).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('forwards frozen selection and idempotency using server-only credentials, private responses', async () => {
    const fetcher = backend()
    const payload = stagePayload(fixtureReview(), 'DEFERRED', true)
    const response = await POST(context('staging', { body: payload }))
    expect(response.status).toBe(200)
    const [url, init] = fetcher.mock.calls[0] ?? []
    expect(String(url)).toBe(
      'http://catalog.example/api/v1/catalog/draft/staging'
    )
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer server-only-fixture'
    )
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
      'review-fixture-key'
    )
    expect(
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    ).toEqual(payload)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.text()).not.toContain('server-only-fixture')
  })
  it('preserves backend stale-review refusal instead of returning success', async () => {
    backend(409, {})
    expect(
      (
        await POST(
          context('staging', {
            body: stagePayload(fixtureReview(), 'APPROVED', true)
          })
        )
      ).status
    ).toBe(409)
  })
  it('hides final review from edit-only accounts and rejects malformed upstream success', async () => {
    const fetcher = backend(200, {})
    expect(
      (await GET(context('final-review', { method: 'GET', apply: false })))
        .status
    ).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
    expect((await GET(context('staging', { method: 'GET' }))).status).toBe(503)
  })
  it('clears Preview only after a same-origin verified exit, without clearing authoring cookies', async () => {
    const fetcher = backend()
    const ctx = context('exit')
    ctx.cookies.set(CONTEXT_COOKIE, 'legacy-preview')
    expect((await POST(ctx)).status).toBe(204)
    expect(ctx.cookies.get(CONTEXT_COOKIE)).toBeUndefined()
    expect(ctx.cookies.get(AUTHORING_CSRF_COOKIE)?.value).toBe('a'.repeat(64))
    expect(fetcher).not.toHaveBeenCalled()
  })
})
