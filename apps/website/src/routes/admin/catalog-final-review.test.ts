import { createContext } from 'astro/middleware'
import { describe, expect, it } from 'vitest'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import { GET } from './catalog-final-review'

describe('legacy review URL', () => {
  it('does not expose a stored-approval publication screen anonymously', async () => {
    const context = createContext({
      request: new Request(
        'https://website.example/admin/catalog/final-review'
      ),
      defaultLocale: 'en',
      clientAddress: '127.0.0.1'
    })
    expect((await GET(context)).status).toBe(404)
  })
  it('returns an authorized reviewer to the checkbox-only console without an API request', async () => {
    const context = createContext({
      request: new Request(
        'https://website.example/admin/catalog/final-review'
      ),
      defaultLocale: 'en',
      clientAddress: '127.0.0.1'
    })
    context.locals.catalogAuthoring = {
      csrf: 'fixture',
      credential: 'server-only-fixture',
      actor_uid: 'fixture',
      owner_uid: 'fixture',
      can_edit: true,
      can_apply: true,
      state: fixtureReview().state
    }
    const response = await GET(context)
    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe('/admin/catalog')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
})
