import { describe, expect, it, vi } from 'vitest'
import { previewNavigationPath, updateCatalogPreview } from './preview-client'

describe('Preview navigation', () => {
  it.for([
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
  it.for([
    'https://evil.test',
    '//evil.test',
    '/%2f%2fevil.test',
    '/\\evil.test',
    '/bad%00path',
    '/bad%ZZ'
  ])('rejects unsafe return path %s with or without a locale', (path) => {
    expect(previewNavigationPath(path, 'zh-CN')).toBeUndefined()
    expect(previewNavigationPath(path)).toBeUndefined()
  })
  it('keeps a same-origin path unchanged without a locale', () => {
    expect(previewNavigationPath('/admin/catalog')).toBe('/admin/catalog')
  })
})

describe('Preview cookie command transport', () => {
  it('posts fixed same-origin JSON/CSRF and requires committed 204 without reading a response body', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
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
  it.for([200, 400, 403, 503])(
    'does not treat status %s as a committed cookie update',
    async (status) => {
      vi.mocked(globalThis.fetch).mockImplementation(
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
    vi.mocked(globalThis.fetch).mockImplementation(
      vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('Offline'))
    )
    expect(await updateCatalogPreview({ view: 'DRAFT' }, 'fixture-csrf')).toBe(
      false
    )
  })
  it('does not send a mutation without CSRF', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    expect(await updateCatalogPreview({ view: 'DRAFT' }, '')).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('previewNavigationPath across catalog locales', () => {
  it.for([
    ['/hub/workflows/a/?q=1#x', 'ja', '/ja/hub/workflows/a/?q=1#x'],
    ['/zh-CN/hub/workflows/a/', 'ja', '/ja/hub/workflows/a/'],
    ['/ja/hub/workflows/a/', 'zh-CN', '/zh-CN/hub/workflows/a/'],
    ['/ja/hub/workflows/a/', 'en', '/hub/workflows/a/'],
    ['/ja', 'en', '/']
  ] as const)('%s → %s', ([path, locale, expected]) => {
    expect(previewNavigationPath(path, locale)).toBe(expected)
  })
})
