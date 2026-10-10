import { describe, expect, it, vi } from 'vitest'

import { catalogFetch, demoMode, newDemoCredential } from './demo'

const site = (path: string) => new URL(path, 'https://cms-demo.invalid')
const visitor = () => ({
  headers: { Authorization: `Bearer ${newDemoCredential()}` }
})
const auth = visitor()

// The first request loads the 180-record seed, which takes a few seconds.
describe('Hub admin demo', { timeout: 30_000 }, () => {
  it.for([
    ['1', 'preview', true],
    ['1', 'production', false],
    ['', 'preview', false]
  ] as const)('with demo %j on %s is %s', ([flag, environment, expected]) => {
    vi.stubEnv('SITE_CATALOG_DEMO', flag)
    vi.stubEnv('VERCEL_ENV', environment)
    expect(demoMode()).toBe(expected)
  })

  it('answers the site API from sample data without the network', async () => {
    vi.stubEnv('SITE_CATALOG_DEMO', '1')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const network = vi.spyOn(globalThis, 'fetch')
    const review = await catalogFetch(site('/admin/api/site/review'), auth)
    expect(review.status).toBe(200)
    expect(await review.json()).toMatchObject({ can_apply: true })
    expect((await catalogFetch(site('/admin/api/site/review'))).status).toBe(
      401
    )
    expect(network).not.toHaveBeenCalled()
  })

  it('publishes into the in-memory draft', async () => {
    vi.stubEnv('SITE_CATALOG_DEMO', '1')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const before = await (
      await catalogFetch(site('/admin/api/site/review'), auth)
    ).json()
    const published = await catalogFetch(site('/admin/api/site/publish'), {
      ...auth,
      method: 'POST',
      body: '{}'
    })
    expect(published.status).toBe(204)
    const after = await (
      await catalogFetch(site('/admin/api/site/review'), auth)
    ).json()
    expect(after.live.revision_id).toBe(before.live.revision_id + 1)
  })

  it('keeps each visitor in a sandbox of their own', async () => {
    vi.stubEnv('SITE_CATALOG_DEMO', '1')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const first = visitor()
    await catalogFetch(site('/admin/api/site/publish'), {
      ...first,
      method: 'POST',
      body: '{}'
    })
    const revision = async (who: RequestInit) =>
      (await (await catalogFetch(site('/admin/api/site/review'), who)).json())
        .live.revision_id
    expect(await revision(first)).toBe((await revision(visitor())) + 1)
  })
})
