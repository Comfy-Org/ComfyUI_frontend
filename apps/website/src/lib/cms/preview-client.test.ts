import { describe, expect, it, vi } from 'vitest'
import { previewNavigationPath, updateCatalogPreview } from './preview-client'

describe('Preview navigation', () => {
  it.each([
    {
      path: '/hub/models/example/?a=1#inputs',
      locale: 'zh-CN' as const,
      expected: '/zh-CN/hub/models/example/?a=1#inputs'
    },
    {
      path: '/zh-CN/hub/workflows/example/?x=2#examples',
      locale: 'en' as const,
      expected: '/hub/workflows/example/?x=2#examples'
    },
    {
      path: '/zh-CN/hub/apps/',
      locale: 'zh-CN' as const,
      expected: '/zh-CN/hub/apps/'
    },
    { path: '/zh-CNish/', locale: 'en' as const, expected: '/zh-CNish/' },
    { path: '/', locale: 'zh-CN' as const, expected: '/zh-CN/' },
    { path: '/zh-CN', locale: 'en' as const, expected: '/' }
  ])(
    'keeps page identity and suffix when localizing $path to $locale',
    ({ path, locale, expected }) => {
      expect(previewNavigationPath(path, locale)).toBe(expected)
    }
  )
  it.each([
    'https://evil.test',
    '//evil.test',
    '/%2f%2fevil.test',
    '/\\evil.test',
    '/bad%00path',
    '/bad%ZZ'
  ])('rejects unsafe return path %s', (path) => {
    expect(previewNavigationPath(path, 'zh-CN')).toBeUndefined()
  })
})

describe('Preview cookie command transport', () => {
  it('posts fixed same-origin JSON/CSRF and requires committed 204 without reading a response body', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    expect(
      await updateCatalogPreview({ view: 'LIVE', now: 'now' }, 'fixture-csrf')
    ).toBe(true)
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      '/admin/catalog-preview',
      expect.objectContaining({
        method: 'POST',
        body: '{"view":"LIVE","now":"now"}',
        headers: {
          'Content-Type': 'application/json',
          'X-Comfy-CSRF': 'fixture-csrf'
        },
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        signal: expect.any(AbortSignal)
      })
    )
  })
  it.each([200, 400, 403, 503])(
    'does not treat status %s as a committed cookie update',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof globalThis.fetch>()
          .mockResolvedValue(new Response(null, { status }))
      )
      expect(
        await updateCatalogPreview({ view: 'DRAFT' }, 'fixture-csrf')
      ).toBe(false)
    }
  )
  it('fails closed on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('Offline'))
    )
    expect(await updateCatalogPreview({ view: 'DRAFT' }, 'fixture-csrf')).toBe(
      false
    )
  })
  it('does not send a mutation without CSRF', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    expect(await updateCatalogPreview({ view: 'DRAFT' }, '')).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
