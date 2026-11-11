import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'
import type { AssetItem } from './schema'
import { getAssetSubfolder } from './metadata'

function createAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return fromPartial({
    id: 'asset-1',
    name: 'clip.webm',
    tags: ['output'],
    ...overrides
  })
}
describe('getAssetSubfolder', () => {
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
