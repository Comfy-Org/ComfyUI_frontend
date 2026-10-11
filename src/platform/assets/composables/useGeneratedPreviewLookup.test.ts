import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsQuery } from '@/platform/assets/composables/useAssetsQuery'
import { isAssetPreviewSupported } from '@/platform/assets/utils/assetPreviewUtil'

import { useGeneratedPreviewLookup } from './useGeneratedPreviewLookup'

vi.mock(import('@/platform/assets/composables/useAssetsQuery'))
vi.mock(import('@/platform/assets/utils/assetPreviewUtil'))

function exr(id: string, name: string, previewUrl: string): AssetItem {
  return fromPartial({
    id,
    name,
    preview_id: `${id}-preview`,
    preview_url: previewUrl
  })
}

function withAssets(inputs: AssetItem[], outputs: AssetItem[]) {
  vi.mocked(isAssetPreviewSupported).mockReturnValue(true)
  vi.mocked(useAssetsQuery).mockImplementation((params) =>
    fromPartial({
      items: ref(params?.tags_any?.includes('input') ? inputs : outputs)
    })
  )
  return useGeneratedPreviewLookup()
}

describe('useGeneratedPreviewLookup', () => {
  it('finds the asset with the given id when filenames collide', () => {
    const find = withAssets(
      [exr('input-sky', 'sky.exr', '/input-preview.jpg')],
      [
        exr('run-a', 'sky.exr', '/run-a-preview.jpg'),
        exr('run-b', 'sky.exr', '/run-b-preview.jpg')
      ]
    )

    expect(find('sky.exr', 'run-b')).toBe('/run-b-preview.jpg')
  })

  it('falls back to the filename without an id', () => {
    const find = withAssets([], [exr('run-a', 'sky.exr', '/run-a-preview.jpg')])

    expect(find('sky.exr')).toBe('/run-a-preview.jpg')
  })

  it('finds nothing where asset previews are unsupported', () => {
    vi.mocked(isAssetPreviewSupported).mockReturnValue(false)

    expect(useGeneratedPreviewLookup()('sky.exr')).toBe('')
    expect(useAssetsQuery).not.toHaveBeenCalled()
  })
})
