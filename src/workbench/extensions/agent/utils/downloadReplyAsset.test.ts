import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReplyAsset } from './replyAssets'
import { downloadReplyAsset } from './downloadReplyAsset'

const fetchApi = vi.hoisted(() => vi.fn())
const downloadBlob = vi.hoisted(() => vi.fn())
vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (route: string) => `http://localhost/api${route}`,
    fetchApi
  }
}))
vi.mock('@/base/common/downloadUtil', () => ({ downloadBlob }))
vi.mock('@/platform/assets/utils/assetPreviewUtil', () => ({
  isAssetPreviewSupported: () => false,
  findOutputAsset: vi.fn()
}))

const asset = (url: string): ReplyAsset => ({
  url,
  filename: 'a.png',
  kind: 'image'
})
const ok = () => ({ ok: true, blob: async () => new Blob() })

describe('downloadReplyAsset', () => {
  beforeEach(() => {
    fetchApi.mockReset().mockResolvedValue(ok())
    downloadBlob.mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok()))
  })

  it('routes an exact same-origin API view path through fetchApi', async () => {
    await downloadReplyAsset(asset('http://localhost/api/view?filename=a.png'))

    expect(fetchApi).toHaveBeenCalledWith('/view?filename=a.png')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('routes an off-origin asset URL through fetchApi', async () => {
    const url = 'https://cdn.example.com/signed/a.png'

    await downloadReplyAsset(asset(url))

    expect(fetchApi).toHaveBeenCalledWith(url)
    expect(fetch).not.toHaveBeenCalled()
  })

  // W10 target behavior is tracked by source PR #16211.
  it.todo('W10: should fetch off-origin asset URLs without routing through apiURL')
})
