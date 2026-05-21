import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getMediaDisplayName } from '@/platform/missingMedia/composables/useMissingMediaInteractions'

const mockInputAssetsByFilename = new Map<string, AssetItem>()

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    inputAssetsByFilename: mockInputAssetsByFilename
  })
}))

const baseAsset: AssetItem = {
  id: 'asset-1',
  name: '',
  tags: ['input'],
  size: 1024
}

describe('getMediaDisplayName', () => {
  beforeEach(() => {
    mockInputAssetsByFilename.clear()
  })

  it('returns the input string when no matching asset is in the store (OSS pass-through)', () => {
    expect(getMediaDisplayName('sunset.png')).toBe('sunset.png')
  })

  it('returns display_name when the matched asset carries one (Cloud unified shape)', () => {
    const hash = 'blake3:abc1234567890def.png'
    mockInputAssetsByFilename.set(hash, {
      ...baseAsset,
      name: hash,
      asset_hash: hash,
      display_name: 'sunset.png'
    })
    expect(getMediaDisplayName(hash)).toBe('sunset.png')
  })

  it('falls back to asset.name when display_name is absent (legacy Cloud asset)', () => {
    const hash = 'blake3:def4567890abc1234.png'
    mockInputAssetsByFilename.set(hash, {
      ...baseAsset,
      name: 'beach.png',
      asset_hash: hash
    })
    expect(getMediaDisplayName(hash)).toBe('beach.png')
  })

  it('prefers metadata.filename over display_name and asset.name (shared helper chain)', () => {
    const hash = 'blake3:fff1111222.png'
    mockInputAssetsByFilename.set(hash, {
      ...baseAsset,
      name: hash,
      asset_hash: hash,
      display_name: 'from_display.png',
      metadata: { filename: 'from_metadata.png' }
    })
    expect(getMediaDisplayName(hash)).toBe('from_metadata.png')
  })

  it('falls back to display_name when filename metadata is absent (Cloud hash-keyed asset)', () => {
    const hash = 'blake3:aaa2222333.png'
    mockInputAssetsByFilename.set(hash, {
      ...baseAsset,
      name: hash,
      asset_hash: hash,
      display_name: 'pretty.png'
    })
    expect(getMediaDisplayName(hash)).toBe('pretty.png')
  })
})
