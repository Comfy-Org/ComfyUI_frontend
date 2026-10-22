// @vitest-environment node
import { createContext } from 'astro/middleware'
import { describe, expect, it, vi } from 'vitest'
import {
  AUTHORING_COOKIE,
  AUTHORING_CSRF_COOKIE
} from '@/lib/cms/authoring-session'
import { DELETE, POST } from './content-session'

const uid = '00000000-0000-4000-8000-000000000001'
const authority = {
  actor_uid: uid,
  owner_uid: uid,
  can_edit: true,
  can_apply: false,
  state: {
    live_rev: 1,
    draft_rev: 7,
    previous_live_rev: null,
    next_rev: 8,
    draft_generation: 4
  }
}
function context(origin = 'https://website.example', csrf = 'a'.repeat(64)) {
  const ctx = createContext({
    request: new Request('https://website.example/admin/content-session', {
      method: 'POST',
      headers: {
        Origin: origin,
        Authorization: 'Bearer private-fixture-token',
        'X-Comfy-CSRF': csrf
      }
    }),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  ctx.cookies.set(AUTHORING_CSRF_COOKIE, 'a'.repeat(64))
  return ctx
}
function backend(status = 200, body: unknown = authority) {
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://catalog.example')
  vi.stubEnv('VERCEL_ENV', 'preview')
  const fetcher = vi.fn().mockResolvedValue(Response.json(body, { status }))
  vi.mocked(fetch).mockImplementation(fetcher)
  return fetcher
}
describe('separate CCC authoring sessions', () => {
  it('establishes HttpOnly cookies only after verified backend authority', async () => {
    const fetcher = backend()
    const ctx = context()
    const response = await POST(ctx)
    expect(response.status).toBe(204)
    expect(fetcher.mock.calls[0][0].pathname).toBe(
      '/api/v1/catalog/authoring-context'
    )
    expect(fetcher.mock.calls[0][1].headers.get('Authorization')).toBe(
      'Bearer private-fixture-token'
    )
    expect(ctx.cookies.get(AUTHORING_COOKIE)?.value).toBe(
      'private-fixture-token'
    )
    const cookies = [...ctx.cookies.headers()].join('\n')
    expect(cookies).toContain('HttpOnly')
    expect(cookies).toContain('Secure')
    expect(cookies).toContain('SameSite=Strict')
    expect(await response.text()).toBe('')
    expect(response.headers.has('Authorization')).toBe(false)
  })
  it.for([401, 403])(
    'does not establish rejected/expired/revoked identity (%s)',
    async (status) => {
      backend(status, { error: 'denied' })
      const ctx = context()
      expect((await POST(ctx)).status).toBe(403)
      expect(ctx.cookies.has(AUTHORING_COOKIE)).toBe(false)
    }
  )
  it('cannot trust a grant-free successful context', async () => {
    backend(200, { ...authority, can_edit: false, can_apply: false })
    expect((await POST(context())).status).toBe(403)
  })
  it('fails closed when current authority is unavailable or malformed', async () => {
    backend(200, { live_rev: 1 })
    expect((await POST(context())).status).toBe(503)
  })
  it('rejects a cross-origin session exchange before calling Cloud', async () => {
    const fetcher = backend()
    expect((await POST(context('https://attacker.example'))).status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('requires Origin and CSRF for logout', async () => {
    expect(
      (await DELETE(context('https://website.example', 'b'.repeat(64)))).status
    ).toBe(403)
    const ctx = context()
    ctx.cookies.set(AUTHORING_COOKIE, 'private-fixture-token')
    expect((await DELETE(ctx)).status).toBe(204)
    expect(ctx.cookies.has(AUTHORING_COOKIE)).toBe(false)
  })
})
