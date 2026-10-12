// @vitest-environment node
import { createContext } from 'astro/middleware'
import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTHORING_COOKIE,
  AUTHORING_CSRF_COOKIE
} from '@/lib/cms/authoring-session'
import { POST } from './local-access'
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))
const authority = {
  actor_uid: '00000000-0000-4000-8000-000000000003',
  owner_uid: '00000000-0000-4000-8000-000000000001',
  can_edit: true,
  can_apply: true,
  state: {
    live_rev: 1,
    draft_rev: 2,
    draft_generation: 0,
    next_rev: 3,
    previous_live_rev: null
  }
}
function context(
  extra: Record<string, string> = {},
  host = '127.0.0.1',
  address = '127.0.0.1'
) {
  return createContext({
    request: new Request(`http://${host}:4349/admin/local-session`, {
      method: 'POST',
      headers: { Origin: `http://${host}:4349`, ...extra }
    }),
    defaultLocale: 'en',
    clientAddress: address
  })
}
describe('explicit loopback CCC fixture sign-in', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
    vi.stubEnv(
      'SITE_CATALOG_LOCAL_AUTHORING_CREDENTIAL_FILE',
      '/private/local/fixture.jwt'
    )
    vi.mocked(readFile).mockResolvedValue('signed-local-fixture')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(authority))
    )
  })
  it('verifies the actual backend before minting HttpOnly cookies and redirecting to CCC', async () => {
    const ctx = context()
    const result = await POST(ctx)
    expect(result.status).toBe(303)
    expect(result.headers.get('Location')).toBe('/admin/catalog')
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
    expect(ctx.cookies.get(AUTHORING_COOKIE)?.value).toBe(
      'signed-local-fixture'
    )
    expect(ctx.cookies.get(AUTHORING_CSRF_COOKIE)?.value).toMatch(
      /^[a-f0-9]{64}$/
    )
    expect(await result.text()).not.toContain('signed-local-fixture')
  })
  it.each([
    'forwarded',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto'
  ])(
    'rejects the proxy header %s before reading the credential',
    async (header) => {
      expect((await POST(context({ [header]: 'attacker' }))).status).toBe(404)
      expect(readFile).not.toHaveBeenCalled()
    }
  )
  it('refuses remote hosts, remote clients, cross-origin requests and deployed environments', async () => {
    expect((await POST(context({}, 'website.example'))).status).toBe(404)
    expect((await POST(context({}, '127.0.0.1', '192.168.1.2'))).status).toBe(
      404
    )
    expect(
      (await POST(context({ Origin: 'https://attacker.example' }))).status
    ).toBe(404)
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect((await POST(context())).status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })
  it('refuses revoked tokens and non-fixture accounts without setting cookies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 403 }))
    )
    const denied = context()
    expect((await POST(denied)).status).toBe(403)
    expect(denied.cookies.get(AUTHORING_COOKIE)).toBeUndefined()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...authority,
          actor_uid: '00000000-0000-4000-8000-000000000009'
        })
      )
    )
    const unrelated = context()
    expect((await POST(unrelated)).status).toBe(403)
    expect(unrelated.cookies.get(AUTHORING_COOKIE)).toBeUndefined()
  })
})
