import { describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { getAssetUrl } from './assetUrlUtil'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `/api${path}`
  }
}))

function makeAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return { id: 'a', name: 'a.png', tags: [], ...overrides }
}

describe(getAssetUrl, () => {
  it('uses hash-based URL for cloud assets with asset_hash', () => {
    const asset = makeAsset({ asset_hash: 'abc123' })

    const url = getAssetUrl(asset)

    expect(url).toBe('/api/view?filename=abc123')
  })

  it('uses name+type+subfolder for OSS assets without asset_hash', () => {
    const asset = makeAsset({
      name: 'image.png',
      tags: ['output'],
      user_metadata: { subfolder: 'results' }
    })

    const url = getAssetUrl(asset)

    expect(url).toContain('filename=image.png')
    expect(url).toContain('type=output')
    expect(url).toContain('subfolder=results')
  })

  it('omits subfolder when empty', () => {
    const asset = makeAsset({
      name: 'image.png',
      tags: ['output'],
      user_metadata: { subfolder: '' }
    })

    const url = getAssetUrl(asset)

    expect(url).not.toContain('subfolder')
  })

  it('uses defaultType when asset has no tags', () => {
    const asset = makeAsset({ name: 'file.png', tags: [] })

    const url = getAssetUrl(asset, 'input')

    expect(url).toContain('type=input')
  })

  it('falls back to output when no defaultType specified', () => {
    const asset = makeAsset({ name: 'file.png', tags: [] })

    const url = getAssetUrl(asset)

    expect(url).toContain('type=output')
  })
})
