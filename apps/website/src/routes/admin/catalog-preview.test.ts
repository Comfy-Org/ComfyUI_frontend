// @vitest-environment node
import { createContext } from 'astro/middleware'
import { describe, expect, it } from 'vitest'
import { AUTHORING_CSRF_COOKIE } from '@/lib/cms/authoring-session'
import { currentCatalogPreview } from '@/lib/cms/catalog-preview'
import { POST } from './catalog-preview'

function context(
  body: unknown = { view: 'DRAFT' },
  origin = 'https://website.example',
  staff = true
) {
  const ctx = createContext({
    request: new Request('https://website.example/admin/catalog-preview', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-Comfy-CSRF': 'a'.repeat(64)
      },
      body: JSON.stringify(body)
    }),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  ctx.cookies.set(AUTHORING_CSRF_COOKIE, 'a'.repeat(64))
  if (staff)
    ctx.locals.catalogAuthoring = {
      credential: 'verified-test-credential',
      csrf: 'a'.repeat(64),
      actor_uid: '00000000-0000-4000-8000-000000000003',
      owner_uid: '00000000-0000-4000-8000-000000000001',
      can_edit: true,
      can_apply: false,
      state: {
        live_rev: 1,
        draft_rev: 2,
        next_rev: 3,
        draft_generation: 0,
        previous_live_rev: null
      }
    }
  return ctx
}
describe('private Preview command route', () => {
  it('commits only after verified caller and same-origin CSRF, returning exact 204', async () => {
    const ctx = context()
    const response = await POST(ctx)
    expect(response.status).toBe(204)
    expect(currentCatalogPreview(ctx).view).toBe('DRAFT')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('does not mutate on cross-origin or missing staff context', async () => {
    const denied = context({ view: 'DRAFT' }, 'https://attacker.invalid')
    expect((await POST(denied)).status).toBe(403)
    expect(currentCatalogPreview(denied).view).toBe('LIVE')
    expect((await POST(context({}, undefined, false))).status).toBe(404)
  })
  it.each([
    { view: 'DRAFT', now: 'invalid' },
    { view: 'LIVE', rev: 9 },
    { view: 'DRAFT', locale: 'unknown' }
  ])(
    'rejects malformed commands without partial cookie writes: %j',
    async (body) => {
      const ctx = context(body)
      expect((await POST(ctx)).status).toBe(400)
      expect(currentCatalogPreview(ctx).view).toBe('LIVE')
    }
  )
})
