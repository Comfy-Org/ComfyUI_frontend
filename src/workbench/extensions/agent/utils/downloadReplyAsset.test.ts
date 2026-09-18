import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReplyAsset } from './replyAssets'
import { downloadReplyAsset } from './downloadReplyAsset'

const fetchApi = vi.hoisted(() => vi.fn())
const downloadBlob = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    apiURL: (route: string) => `${window.location.origin}/api${route}`,
    fetchApi
  }
}))
vi.mock<unknown>(import('@/base/common/downloadUtil'), () => ({ downloadBlob }))
vi.mock<unknown>(import('@/platform/assets/utils/assetPreviewUtil'), () => ({
  isAssetPreviewSupported: () => false,
  findOutputAsset: vi.fn()
}))

const asset = (url: string): ReplyAsset => ({
  url,
  filename: 'a.png',
  kind: 'image'
})
const ok = () => new Response(new Blob(), { status: 200 })

describe('downloadReplyAsset', () => {
  beforeEach(() => {
    fetchApi.mockReset().mockImplementation(async () => ok())
    downloadBlob.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ok())
    )
  })

  it('authenticates only an exact same-origin API view route', async () => {
    await downloadReplyAsset(
      asset(`${window.location.origin}/api/view?filename=a.png`)
    )
    expect(fetchApi).toHaveBeenCalledWith('/view?filename=a.png')
    expect(fetch).not.toHaveBeenCalled()

    fetchApi.mockClear()
    const embeddedApiUrl = `https://evil.example/x/${window.location.origin}/api/view?filename=a.png`
    await downloadReplyAsset(asset(embeddedApiUrl))
    expect(fetchApi).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(embeddedApiUrl, { credentials: 'omit' })

    vi.mocked(fetch).mockClear()
    const sameOriginNonViewUrl = `${window.location.origin}/api/system_stats`
    await downloadReplyAsset(asset(sameOriginNonViewUrl))
    expect(fetchApi).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(sameOriginNonViewUrl, {
      credentials: 'omit'
    })
  })
})
