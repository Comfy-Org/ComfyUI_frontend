// @vitest-environment node
import { createContext } from 'astro/middleware'
import type { ContentCatalogReview } from '@comfyorg/ingest-types'
import { expect, it, vi } from 'vitest'
import { POST as signIn } from './session'
import { POST as testerSignIn } from './tester-session'
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  CONTEXT_COOKIE,
  verifySiteSession
} from '@/lib/cms/admin'
import {
  TESTER_COOKIE,
  localCredential,
  redeemInvitation
} from '@/lib/cms/testers'

vi.mock(import('@/lib/cms/admin'), { spy: true })
vi.mock(import('@/lib/cms/testers'), { spy: true })

const review: ContentCatalogReview = {
  draft: { revision_id: 2, generation: 1, items: [] },
  live: { revision_id: 1, generation: 1, items: [] },
  can_edit: true,
  can_apply: false,
  history: []
}
const origin = 'https://preview.example'
const csrf = 'a'.repeat(64)

function context(path: string, requestOrigin = origin) {
  const result = createContext({
    request: new Request(origin + path, {
      method: 'POST',
      headers: {
        Origin: requestOrigin,
        Authorization: 'Bearer test-only',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ csrf, code: 'b'.repeat(64) }).toString()
    }),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  result.cookies.set(CSRF_COOKIE, csrf)
  return result
}

it('rejects cross-site staff sign-in before checking credentials', async () => {
  const ctx = context('/admin/session', 'https://attacker.invalid')
  expect((await signIn(ctx)).status).toBe(403)
  expect(verifySiteSession).not.toHaveBeenCalled()
  expect(ctx.cookies.has(SESSION_COOKIE)).toBe(false)
})

it('does not create a staff cookie for an unauthorized account', async () => {
  vi.mocked(verifySiteSession).mockResolvedValue(undefined)
  const ctx = context('/admin/session')
  expect((await signIn(ctx)).status).toBe(403)
  expect(ctx.cookies.has(SESSION_COOKIE)).toBe(false)
})

it('exchanges a verified staff credential and replaces tester context', async () => {
  vi.mocked(verifySiteSession).mockResolvedValue(review)
  const ctx = context('/admin/session')
  ctx.cookies.set(TESTER_COOKIE, 'old-test-session')
  expect((await signIn(ctx)).status).toBe(204)
  expect(ctx.cookies.get(SESSION_COOKIE)?.value).toBe('test-only')
  expect(ctx.cookies.has(TESTER_COOKIE)).toBe(false)
})

function testerContext() {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('SITE_CATALOG_LOCAL_CREDENTIAL_FILE', '/private/test-only.json')
  vi.mocked(localCredential).mockResolvedValue({
    credential: 'parent-test-only',
    expires_at: '2030-01-01T00:00:00Z'
  })
  vi.mocked(verifySiteSession).mockResolvedValue(review)
  return context('/admin/tester-session')
}

it('rejects invitation redemption without CSRF authorization', async () => {
  const ctx = testerContext()
  ctx.cookies.delete(CSRF_COOKIE)
  expect((await testerSignIn(ctx)).status).toBe(403)
  expect(redeemInvitation).not.toHaveBeenCalled()
})

it('fails closed if the parent account is no longer authorized', async () => {
  const ctx = testerContext()
  vi.mocked(verifySiteSession).mockResolvedValue(undefined)
  expect((await testerSignIn(ctx)).status).toBe(503)
  expect(redeemInvitation).not.toHaveBeenCalled()
})

it('rejects invalid or already-used invitations without issuing a session', async () => {
  const ctx = testerContext()
  vi.mocked(redeemInvitation).mockResolvedValue(undefined)
  expect((await testerSignIn(ctx)).status).toBe(403)
  expect(ctx.cookies.has(TESTER_COOKIE)).toBe(false)
})

it('issues an opaque tester session and clears prior Live/Draft selection', async () => {
  const ctx = testerContext()
  vi.mocked(redeemInvitation).mockResolvedValue('test-only-opaque-session')
  ctx.cookies.set(SESSION_COOKIE, 'old-staff-test-only')
  ctx.cookies.set(CONTEXT_COOKIE, JSON.stringify({ view: 'DRAFT' }))
  const response = await testerSignIn(ctx)
  expect(response.status).toBe(303)
  expect(response.headers.get('Location')).toBe('/admin/changes/')
  expect(ctx.cookies.get(TESTER_COOKIE)?.value).toBe('test-only-opaque-session')
  expect(ctx.cookies.has(SESSION_COOKIE)).toBe(false)
  expect(ctx.cookies.has(CONTEXT_COOKIE)).toBe(false)
})
