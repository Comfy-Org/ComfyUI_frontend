// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { catalogResponseNoStore, mutableCatalogPath } from './response-cache'

describe('mutable CMS provider cache policy', () => {
  it.for([200, 304, 400, 403, 404, 503])(
    'preserves status %s and never advertises provider caching',
    (status) => {
      const response = catalogResponseNoStore(
        new Response(null, {
          status,
          headers: {
            'Cache-Control': 'public, max-age=3600',
            Vary: 'Cookie',
            ETag: '"old-live"'
          }
        })
      )
      expect(response.status).toBe(status)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(
        [
          'CDN-Cache-Control',
          'Vercel-CDN-Cache-Control',
          'Cloudflare-CDN-Cache-Control'
        ].map((name) => response.headers.get(name))
      ).toEqual(['no-store', 'no-store', 'no-store'])
      expect(response.headers.get('X-Comfy-Content-Source')).toBe('cms')
      expect(response.headers.get('Vary')).toBe('Cookie')
    }
  )

  it('handles immutable redirect headers without changing the destination', () => {
    const response = catalogResponseNoStore(
      Response.redirect('https://demo.test/admin/catalog-sign-in', 303)
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe(
      'https://demo.test/admin/catalog-sign-in'
    )
    expect(response.headers.get('CDN-Cache-Control')).toBe('no-store')
  })

  it('preserves response bytes and separate session cookies', async () => {
    const headers = new Headers()
    headers.append('Set-Cookie', 'first=fixture; HttpOnly')
    headers.append('Set-Cookie', 'second=fixture; HttpOnly')
    const response = catalogResponseNoStore(
      new Response('exact body', { headers })
    )
    expect(await response.text()).toBe('exact body')
    expect(response.headers.getSetCookie()).toEqual([
      'first=fixture; HttpOnly',
      'second=fixture; HttpOnly'
    ])
  })

  it.for([
    '/hub/workflows/',
    '/zh-CN/hub/models/item/',
    '/ja/hub/workflows/item/',
    '/hub.md',
    '/sitemap-index.xml',
    '/zh-CN/sitemap-catalog.xml',
    '/llms-full.txt',
    '/models/workflows/item/page.json',
    '/admin/catalog',
    '/admin/catalog-api/staging',
    '/api/v1/catalog/items',
    '/agents',
    '/openapi.json',
    '/preview-media/7/id/pin'
  ])('covers %s', (path) => expect(mutableCatalogPath(path)).toBe(true))
  it.for([
    '/_astro/component.hash.js',
    '/assets/image.hash.webp',
    '/favicon.svg',
    '/images/logo.svg',
    '/pricing'
  ])('does not intercept %s', (path) =>
    expect(mutableCatalogPath(path)).toBe(false)
  )
})
