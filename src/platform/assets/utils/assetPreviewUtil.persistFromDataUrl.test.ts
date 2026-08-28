import { beforeEach, describe, expect, it, vi } from 'vitest'

const uploadAssetFromBase64 = vi.hoisted(() => vi.fn())
vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    isAssetAPIEnabled: () => true,
    uploadAssetFromBase64
  }
}))
const fetchApi = vi.hoisted(() =>
  vi.fn(async () => ({ json: async () => ({ assets: [] }) }))
)
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi,
    apiURL: (path: string) => path,
    getServerFeature: () => true
  }
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({ setAssetPreview: vi.fn() })
}))

import { persistThumbnailFromDataUrl } from './assetPreviewUtil'

describe('persistThumbnailFromDataUrl', () => {
  beforeEach(() => {
    uploadAssetFromBase64.mockClear()
    fetchApi.mockClear()
  })

  it('swallows a failed data-url read and uploads nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('bad url')))

    await expect(
      persistThumbnailFromDataUrl('a.glb', 'data:broken')
    ).resolves.toBeUndefined()

    expect(fetchApi).not.toHaveBeenCalled()
    expect(uploadAssetFromBase64).not.toHaveBeenCalled()
  })

  it('converts the data url and reaches the asset lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob()) })
    )

    await persistThumbnailFromDataUrl('a.glb', 'data:image/png;base64,x')

    expect(fetchApi).toHaveBeenCalled()
    expect(uploadAssetFromBase64).not.toHaveBeenCalled()
  })
})
