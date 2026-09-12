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
const ok = (blob = new Blob()) =>
  ({ ok: true, blob: vi.fn().mockResolvedValue(blob) }) satisfies Pick<
    Response,
    'ok' | 'blob'
  >

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

  it('downloads a successful response blob', async () => {
    const blob = new Blob(['image'])
    fetchApi.mockResolvedValueOnce(ok(blob))

    await downloadReplyAsset(asset('http://localhost/api/view?filename=a.png'))

    expect(downloadBlob).toHaveBeenCalledWith('a.png', blob)
  })

  it('propagates network errors without starting a download', async () => {
    const error = new TypeError('network error')
    fetchApi.mockRejectedValueOnce(error)

    await expect(
      downloadReplyAsset(asset('https://cdn.example.com/signed/a.png'))
    ).rejects.toBe(error)
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  // W10 target behavior is tracked by source PR #16211.
  it.todo(
    'W10: should fetch off-origin asset URLs without routing through apiURL'
  )
})
