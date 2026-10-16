// @vitest-environment node
import { createContext } from 'astro/middleware'
import { assert, describe, expect, it, vi } from 'vitest'
import { CSRF_COOKIE, verifySiteSession } from '@/lib/cms/admin'
import { newDemoCredential } from '@/lib/cms/demo'
import type { SiteSession } from '@/lib/cms/admin'
import { POST } from './actions'

function context(
  action: string,
  session?: SiteSession,
  fields: Record<string, string> = {}
) {
  const csrf = 'b'.repeat(64)
  const ctx = createContext({
    request: new Request('https://preview.example/admin/actions', {
      method: 'POST',
      headers: { Origin: 'https://preview.example' },
      body: new URLSearchParams({
        csrf,
        action,
        confirm: 'yes',
        draft_id: '2',
        generation: '1',
        submission: 'shr_b:v1',
        decision: JSON.stringify({ ids: ['a'], status: 'APPROVED' }),
        ...fields
      })
    }),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  ctx.cookies.set(CSRF_COOKIE, csrf)
  ctx.locals.site = session ?? {
    credential: 'test-only',
    csrf,
    review: {
      draft: { revision_id: 2, generation: 1, items: [] },
      live: { revision_id: 1, generation: 1, items: [] },
      can_edit: true,
      can_apply: true,
      history: []
    }
  }
  return ctx
}

describe('legacy admin mutation boundary', () => {
  it.for([
    'publish',
    'revert',
    'reject',
    'save',
    'stage',
    'restoreVersion',
    'undo'
  ])(
    'refuses %s outside the sample-data demo before any upstream write',
    async (action) => {
      vi.stubEnv('SITE_CATALOG_API_URL', 'https://ingest.example')
      vi.stubEnv('SITE_CATALOG_DEMO', '')
      vi.stubEnv('VERCEL_ENV', 'preview')
      vi.mocked(fetch).mockImplementation(
        async () => new Response(null, { status: 204 })
      )
      const response = await POST(
        context(action, undefined, { approve: 'shr_a:v3' })
      )
      expect(response.status).toBe(404)
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('cannot re-enable legacy publishing on production with the demo flag', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'https://ingest.example')
    vi.stubEnv('SITE_CATALOG_DEMO', '1')
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await POST(context('publish'))).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('publishes only sample data in the explicit demo without network writes', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'https://ingest.example')
    vi.stubEnv('SITE_CATALOG_DEMO', '1')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const credential = newDemoCredential()
    const review = await verifySiteSession(credential)
    assert.exists(review)
    const ctx = context(
      'publish',
      { credential, csrf: 'b'.repeat(64), review },
      {
        draft_id: String(review.draft.revision_id),
        generation: String(review.draft.generation)
      }
    )
    expect((await POST(ctx)).status).toBe(303)
    const after = await verifySiteSession(credential)
    expect(after?.live.revision_id).toBe(review.draft.revision_id)
    expect(fetch).not.toHaveBeenCalled()
  }, 30_000)
})
