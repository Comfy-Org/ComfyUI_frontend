import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { assetService } from '@/platform/assets/services/assetService'

import { attachPreview } from './attachPreview'

const mocks = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))
vi.mock(import('@/platform/assets/services/assetService'), () =>
  fromPartial({
    assetService: {
      uploadAssetFromBase64: vi.fn(),
      updateAsset: vi.fn()
    }
  })
)

describe('attachPreview', () => {
  it.for([
    { isCloud: false, tags: ['output', 'fe-preview'] },
    { isCloud: true, tags: ['preview'] }
  ])(
    'uploads with tags $tags when isCloud=$isCloud and links it',
    async ({ isCloud, tags }) => {
      mocks.isCloud = isCloud
      vi.mocked(assetService.uploadAssetFromBase64).mockResolvedValue(
        fromPartial({ id: 'preview-id' })
      )

      await attachPreview(
        { id: 'exr-id', name: 'sky.exr' },
        new Blob(['jpeg'], { type: 'image/jpeg' })
      )

      expect(assetService.uploadAssetFromBase64).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'sky.exr_preview.jpg', tags })
      )
      expect(assetService.updateAsset).toHaveBeenCalledWith('exr-id', {
        preview_id: 'preview-id'
      })
    }
  )
})
