import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetSubfolder,
  getAssetUrl
} from '@/platform/assets/utils/assetUrlUtil'

const mockApiURL = vi.hoisted(() =>
  vi.fn((path: string) => `http://localhost:8188/api${path}`)
)

vi.mock('@/scripts/api', () => ({
  api: { apiURL: mockApiURL }
}))

function createAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-1',
    name: 'clip.webm',
    tags: ['output'],
    ...overrides
  } as AssetItem
}

describe('getAssetSubfolder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the subfolder from preview_url', () => {
    const asset = createAsset({
      preview_url: '/api/view?filename=clip.webm&type=output&subfolder=vid/2026'
    })

    expect(getAssetSubfolder(asset)).toBe('vid/2026')
  })

  it('falls back to user_metadata when preview_url carries no subfolder', () => {
    const asset = createAsset({
      preview_url: '/api/view?filename=clip.webm&type=output',
      user_metadata: { subfolder: 'vid/2026' }
    })

    expect(getAssetSubfolder(asset)).toBe('vid/2026')
  })

  it('returns an empty string for an asset at the type root', () => {
    expect(getAssetSubfolder(createAsset())).toBe('')
    expect(
      getAssetSubfolder(
        createAsset({ user_metadata: { subfolder: undefined } })
      )
    ).toBe('')
  })
})

describe('getAssetUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('includes the subfolder carried by preview_url', () => {
    const asset = createAsset({
      preview_url: '/api/view?filename=clip.webm&type=output&subfolder=vid/2026'
    })

    expect(getAssetUrl(asset)).toContain('subfolder=vid%2F2026')
  })

  it('includes the subfolder taken from the user_metadata fallback', () => {
    const asset = createAsset({
      preview_url: '/api/view?filename=clip.webm&type=output',
      user_metadata: { subfolder: 'vid/2026' }
    })

    expect(getAssetUrl(asset)).toContain('subfolder=vid%2F2026')
  })

  it('omits the subfolder param for an asset at the type root', () => {
    expect(getAssetUrl(createAsset())).not.toContain('subfolder')
  })
})
