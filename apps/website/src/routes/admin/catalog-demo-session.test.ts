// @vitest-environment node
import { createContext } from 'astro/middleware'
import { beforeEach, expect, it, vi } from 'vitest'
import { POST } from './catalog-demo-session'
import {
  demoEnabled,
  demoParent,
  redeemDemoInvitation,
  DEMO_LOGIN_CSRF,
  DEMO_COOKIE
} from '@/lib/cms/catalog-demo'
import { verifyAuthoringCredential } from '@/lib/cms/authoring-session'
vi.mock(import('@/lib/cms/catalog-demo'), { spy: true })
vi.mock(import('@/lib/cms/authoring-session'), { spy: true })
const csrf = 'a'.repeat(64)
let address = 0
function context(
  body = `csrf=${csrf}&code=fixture`,
  origin = 'https://website.example'
) {
  const ctx = createContext({
    request: new Request('https://website.example/admin/catalog-demo-session', {
      method: 'POST',
      body,
      headers: {
        Origin: origin,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }),
    defaultLocale: 'en',
    clientAddress: `fixture-${++address}`
  })
  ctx.cookies.set(DEMO_LOGIN_CSRF, csrf)
  return ctx
}
const staff = {
  actor_uid: '00000000-0000-4000-8000-000000000003',
  owner_uid: '00000000-0000-4000-8000-000000000001',
  can_edit: true,
  can_apply: true,
  state: {
    draft_rev: 2,
    live_rev: 1,
    next_rev: 3,
    draft_generation: 0,
    previous_live_rev: null
  }
}
beforeEach(() => {
  vi.mocked(demoEnabled).mockReturnValue(true)
  vi.mocked(demoParent).mockResolvedValue({
    credential: 'fixture-only',
    expires: Date.now() + 60_000
  })
  vi.mocked(verifyAuthoringCredential).mockResolvedValue({
    ok: true,
    context: staff
  })
  vi.mocked(redeemDemoInvitation).mockResolvedValue({
    token: 'fixture-session',
    expires: Date.now() + 60_000
  })
})
it('stays unavailable when demo mode is disabled', async () => {
  vi.mocked(demoEnabled).mockReturnValue(false)
  expect((await POST(context())).status).toBe(404)
  expect(demoParent).not.toHaveBeenCalled()
})
it('requires same-origin form CSRF before checking credentials', async () => {
  expect((await POST(context(undefined, 'https://evil.test'))).status).toBe(403)
  expect((await POST(context('csrf=wrong'))).status).toBe(403)
  expect(demoParent).not.toHaveBeenCalled()
})
it.for([
  { can_edit: false },
  { can_apply: false },
  { actor_uid: 'another-account' },
  { owner_uid: 'another-owner' }
])('refuses an unauthorized parent %o', async (change) => {
  vi.mocked(verifyAuthoringCredential).mockResolvedValue({
    ok: true,
    context: { ...staff, ...change }
  })
  expect((await POST(context())).status).toBe(403)
  expect(redeemDemoInvitation).not.toHaveBeenCalled()
})
it('sets a bounded private session only after successful redemption', async () => {
  const ctx = context()
  const response = await POST(ctx)
  expect(response.status).toBe(303)
  expect(response.headers.get('Location')).toBe('/admin/catalog')
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(ctx.cookies.get(DEMO_COOKIE)?.value).toBe('fixture-session')
  expect(redeemDemoInvitation).toHaveBeenCalledExactlyOnceWith('fixture')
})
it('fails closed on invalid invitations and parent outages', async () => {
  vi.mocked(redeemDemoInvitation).mockResolvedValue(undefined)
  expect((await POST(context())).status).toBe(403)
  vi.mocked(demoParent).mockRejectedValue(new Error('unavailable'))
  expect((await POST(context())).status).toBe(503)
})
