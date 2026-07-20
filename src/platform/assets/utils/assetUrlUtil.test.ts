import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'

const { apiURL } = vi.hoisted(() => ({
  apiURL: vi.fn((path: string) => `https://comfy.local${path}`)
}))

vi.mock('@/scripts/api', () => ({
  api: { apiURL }
}))

function asset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    name: 'folder image.png',
    preview_url: '',
    tags: ['output'],
    created_at: '',
    updated_at: '',
    size: 0,
    mime_type: 'image/png',
    user_metadata: {},
    ...overrides
  } as AssetItem
}

beforeEach(() => {
  apiURL.mockClear()
})

describe('getAssetUrl', () => {
  it('builds encoded view URLs with type and subfolder', () => {
    const url = getAssetUrl(
      asset({
        user_metadata: { subfolder: 'nested/path' }
      })
    )

    expect(apiURL).toHaveBeenCalledWith(
      '/view?filename=folder+image.png&type=output&subfolder=nested%2Fpath'
    )
    expect(url).toBe(
      'https://comfy.local/view?filename=folder+image.png&type=output&subfolder=nested%2Fpath'
    )
  })

  it('uses preview URL type and omits empty subfolders', () => {
    getAssetUrl(
      asset({
        preview_url: '/api/view?filename=image.png&type=temp',
        tags: ['output'],
        user_metadata: { subfolder: '' }
      })
    )

    expect(apiURL).toHaveBeenCalledWith(
      '/view?filename=folder+image.png&type=temp'
    )
  })
})
