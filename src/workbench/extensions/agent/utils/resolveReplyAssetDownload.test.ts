import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import type { ReplyAsset } from './replyAssets'
import { resolveReplyAssetDownload } from './resolveReplyAssetDownload'

vi.mock(import('@/platform/assets/utils/assetPreviewUtil'), () => ({
  isAssetPreviewSupported: () => false,
  findOutputAsset: vi.fn()
}))

function asset(url: string): ReplyAsset {
  return {
    url,
    filename: 'a.png',
    kind: 'image'
  }
}

function ok(): Response {
  return new Response(new Blob(), { status: 200 })
}

describe('resolveReplyAssetDownload', () => {
  beforeEach(() => {
    vi.spyOn(api, 'apiURL').mockImplementation(
      (route) => `${window.location.origin}/api${route}`
    )
    vi.spyOn(api, 'fetchApi').mockImplementation(async () => ok())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ok())
    )
  })

  it('authenticates an exact same-origin API view route', async () => {
    const resolved = await resolveReplyAssetDownload(
      asset(`${window.location.origin}/api/view?filename=a.png`)
    )

    expect(resolved.url).toBe('/view?filename=a.png')
    await resolved.fetch?.(resolved.url)
    expect(api.fetchApi).toHaveBeenCalledWith('/view?filename=a.png')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('omits credentials for an off-origin URL that embeds the API base', async () => {
    const embeddedApiUrl = `https://evil.example/x/${window.location.origin}/api/view?filename=a.png`

    const resolved = await resolveReplyAssetDownload(asset(embeddedApiUrl))

    expect(resolved.url).toBe(embeddedApiUrl)
    await resolved.fetch?.(resolved.url)
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(embeddedApiUrl, { credentials: 'omit' })
  })

  it('omits credentials for a same-origin route that is not the view route', async () => {
    const sameOriginNonViewUrl = `${window.location.origin}/api/system_stats`

    const resolved = await resolveReplyAssetDownload(
      asset(sameOriginNonViewUrl)
    )

    expect(resolved.url).toBe(sameOriginNonViewUrl)
    await resolved.fetch?.(resolved.url)
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(sameOriginNonViewUrl, {
      credentials: 'omit'
    })
  })

  // The trust check compares the whole pathname. Relaxing it to a prefix,
  // suffix or substring match on the view path would silently authenticate
  // every route below, so each one is pinned rather than left to the single
  // `/api/system_stats` case.
  const lookalikeRoutes = [
    ['a descendant of the view route', '/api/view/extra'],
    ['a route whose name starts with the view route', '/api/viewevil'],
    ['a route that only ends with the view route', '/evil/api/view'],
    ['a route that only contains the view route', '/x/api/view/y']
  ] as const

  for (const [description, pathname] of lookalikeRoutes) {
    it(`omits credentials for ${description}`, async () => {
      const lookalikeUrl = `${window.location.origin}${pathname}?filename=a.png`

      const resolved = await resolveReplyAssetDownload(asset(lookalikeUrl))

      expect(resolved.url).toBe(lookalikeUrl)
      await resolved.fetch?.(resolved.url)
      expect(api.fetchApi).not.toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledWith(lookalikeUrl, { credentials: 'omit' })
    })
  }

  it('rejects a malformed URL before resolving a request', async () => {
    await expect(resolveReplyAssetDownload(asset('http://['))).rejects.toThrow()

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
