import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import type { ReplyAsset } from './replyAssets'
import { downloadReplyAsset } from './downloadReplyAsset'

const downloadBlob = vi.hoisted(() => vi.fn())
vi.mock(import('@/base/common/downloadUtil'), () => ({ downloadBlob }))
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

describe('downloadReplyAsset', () => {
  beforeEach(() => {
    vi.spyOn(api, 'apiURL').mockImplementation(
      (route) => `${window.location.origin}/api${route}`
    )
    vi.spyOn(api, 'fetchApi').mockImplementation(async () => ok())
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
    expect(api.fetchApi).toHaveBeenCalledWith('/view?filename=a.png')
    expect(fetch).not.toHaveBeenCalled()

    vi.mocked(api.fetchApi).mockClear()
    const embeddedApiUrl = `https://evil.example/x/${window.location.origin}/api/view?filename=a.png`
    await downloadReplyAsset(asset(embeddedApiUrl))
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(embeddedApiUrl, { credentials: 'omit' })

    vi.mocked(fetch).mockClear()
    const sameOriginNonViewUrl = `${window.location.origin}/api/system_stats`
    await downloadReplyAsset(asset(sameOriginNonViewUrl))
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(sameOriginNonViewUrl, {
      credentials: 'omit'
    })
  })

  it('rejects malformed URLs before starting a request', async () => {
    await expect(downloadReplyAsset(asset('http://['))).rejects.toThrow()

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
