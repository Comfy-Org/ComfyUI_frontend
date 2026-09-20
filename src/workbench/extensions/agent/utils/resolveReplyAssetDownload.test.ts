import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import type { ReplyAsset } from './replyAssets'
import { resolveReplyAssetDownload } from './resolveReplyAssetDownload'

vi.mock(import('@/platform/assets/utils/assetPreviewUtil'), () => ({
  isAssetPreviewSupported: () => false,
  findOutputAsset: vi.fn()
}))

const asset = (url: string): ReplyAsset => ({
  url,
  filename: 'a.png',
  kind: 'image'
})
const ok = () => new Response(new Blob(), { status: 200 })

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

  it('rejects a malformed URL before resolving a request', async () => {
    await expect(resolveReplyAssetDownload(asset('http://['))).rejects.toThrow()

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
