import { describe, expect, it, vi } from 'vitest'

import { proxyCatalogDocumentation } from './discovery'

describe('deployed catalog documentation', () => {
  it.for([
    {
      path: '/agents',
      type: 'text/plain',
      body: 'Contract: ccc-v1-fixture\nHow to edit'
    },
    {
      path: '/openapi.json',
      type: 'application/json',
      body: '{"openapi":"3.0.3","x-ccc-contract-version":"ccc-v1-fixture"}'
    }
  ] as const)(
    'forwards $path without substituting a website contract',
    async ({ path, type, body }) => {
      vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
      const upstream = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(body, { headers: { 'Content-Type': type } })
        )
      vi.mocked(fetch).mockImplementation(upstream)

      const response = await proxyCatalogDocumentation(path)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe(body)
      expect(response.headers.get('Content-Type')).toBe(type)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(upstream).toHaveBeenCalledWith(
        new URL('/api/v1/catalog' + path, 'http://localhost:8099'),
        expect.objectContaining({ cache: 'no-store', redirect: 'error' })
      )
    }
  )

  it.for([
    new Response('Sign in', { headers: { 'Content-Type': 'text/html' } }),
    new Response('Down', { status: 503 })
  ])(
    'returns an explicit failure instead of stale or login HTML',
    async (upstreamResponse) => {
      vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
      vi.mocked(fetch).mockImplementation(
        vi.fn<typeof fetch>().mockResolvedValue(upstreamResponse)
      )

      const response = await proxyCatalogDocumentation('/openapi.json')

      expect(response.status).toBe(503)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
    }
  )

  it('does not enable the review feature in production', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', 'http://localhost:8099')
    vi.stubEnv('VERCEL_ENV', 'production')
    const upstream = vi.fn<typeof fetch>()
    vi.mocked(fetch).mockImplementation(upstream)

    expect((await proxyCatalogDocumentation('/agents')).status).toBe(503)
    expect(upstream).not.toHaveBeenCalled()
  })
})
