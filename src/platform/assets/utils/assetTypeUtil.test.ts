import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetType } from '@/platform/assets/utils/assetTypeUtil'

function asset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    name: 'image.png',
    preview_url: '',
    tags: [],
    created_at: '',
    updated_at: '',
    size: 0,
    mime_type: 'image/png',
    user_metadata: {},
    ...overrides
  } as AssetItem
}

describe('getAssetType', () => {
  it('prefers the preview URL type over tags', () => {
    expect(
      getAssetType(
        asset({
          preview_url: '/api/view?filename=image.png&type=temp',
          tags: ['output']
        })
      )
    ).toBe('temp')
  })

  it('falls back to tags and then the supplied default type', () => {
    expect(getAssetType(asset({ tags: ['input'] }))).toBe('input')
    expect(getAssetType(asset(), 'input')).toBe('input')
  })
})
