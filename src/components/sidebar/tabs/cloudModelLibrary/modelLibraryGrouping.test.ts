import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import {
  directoryForAsset,
  firstNonModelsTag,
  groupAsset,
  groupLabelForAsset,
  partnerKind,
  placeAssetsInGroups,
  rawTagTopLevel
} from './modelLibraryGrouping'

function makeAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'a1',
    name: 'companion.safetensors',
    tags: ['models'],
    ...overrides
  }
}

describe('firstNonModelsTag', () => {
  it('returns the first tag that is not the models tag', () => {
    expect(firstNonModelsTag(makeAsset({ tags: ['models', 'loras'] }))).toBe(
      'loras'
    )
  })

  it('returns null when the only tag is the models tag', () => {
    expect(firstNonModelsTag(makeAsset({ tags: ['models'] }))).toBeNull()
  })
})

describe('rawTagTopLevel', () => {
  it('takes the segment before the first slash', () => {
    expect(rawTagTopLevel('CogVideo/VAE')).toBe('CogVideo')
    expect(rawTagTopLevel('loras')).toBe('loras')
  })
})

describe('partnerKind', () => {
  it('extracts the modality segment of a partner category', () => {
    expect(partnerKind('api node/image/BFL')).toBe('image')
  })

  it('returns empty string when absent', () => {
    expect(partnerKind(undefined)).toBe('')
    expect(partnerKind('api node')).toBe('')
  })
})

describe('groupAsset', () => {
  it('keeps cross-base file types (loras, vae, conditioning) in their bucket', () => {
    expect(
      groupAsset(makeAsset({ tags: ['models', 'loras'] })).groupIds
    ).toEqual(['loras'])
    expect(groupAsset(makeAsset({ tags: ['models', 'vae'] })).groupIds).toEqual(
      ['vae']
    )
    expect(
      groupAsset(makeAsset({ tags: ['models', 'controlnet'] })).groupIds
    ).toEqual(['conditioning'])
  })

  it('places an asset in every group its folder tags map to', () => {
    const shared = makeAsset({ tags: ['models', 'checkpoints', 'loras'] })
    expect(groupAsset(shared).groupIds.sort()).toEqual(['diffusion', 'loras'])
  })

  it('deduplicates groups when several tags map to the same bucket', () => {
    const asset = makeAsset({
      tags: ['models', 'checkpoints/sdxl', 'checkpoints']
    })
    expect(groupAsset(asset).groupIds).toEqual(['diffusion'])
  })

  it('groups by the top-level folder tag, not nested segments', () => {
    expect(
      groupAsset(makeAsset({ tags: ['models', 'CogVideo/VAE'] })).groupIds
    ).toEqual(['video'])
  })

  it('ignores base-model metadata entirely — tags are the only input', () => {
    const clipEncoder = makeAsset({
      tags: ['models', 'text_encoders'],
      metadata: { base_model: 'SDXL' }
    })
    expect(groupAsset(clipEncoder).groupIds).toEqual(['encoders'])
    const videoTransformer = makeAsset({
      tags: ['models', 'diffusion_models'],
      metadata: { base_model: 'LTX 2.3' }
    })
    expect(groupAsset(videoTransformer).groupIds).toEqual(['diffusion'])
  })

  it('leaves unmapped tags unmapped regardless of metadata', () => {
    const result = groupAsset(
      makeAsset({
        tags: ['models', 'intrinsic_loras'],
        metadata: { base_model: 'SD 1.5' }
      })
    )
    expect(result.groupIds).toEqual([])
    expect(result.unmappedTags).toEqual(['intrinsic_loras'])
  })

  it('matches folder tags case-insensitively', () => {
    expect(
      groupAsset(makeAsset({ tags: ['models', 'cogvideo'] })).groupIds
    ).toEqual(['video'])
    expect(
      groupAsset(makeAsset({ tags: ['models', 'llm/florence-2-base'] }))
        .groupIds
    ).toEqual(['language'])
  })

  it('surfaces unmapped tags verbatim by top-level folder', () => {
    const result = groupAsset(
      makeAsset({ tags: ['models', 'kjnodes_fonts', 'loras'] })
    )
    expect(result.groupIds).toEqual(['loras'])
    expect(result.unmappedTags).toEqual(['kjnodes_fonts'])
  })

  it('returns nothing for an asset with only the models tag', () => {
    expect(groupAsset(makeAsset({ tags: ['models'] }))).toEqual({
      groupIds: [],
      unmappedTags: []
    })
  })
})

describe('directoryForAsset', () => {
  it('derives the directory from the reported file path, dropping the models root', () => {
    expect(
      directoryForAsset(
        makeAsset({ file_path: 'models/checkpoints/sdxl/foo.safetensors' })
      )
    ).toBe('checkpoints/sdxl')
  })

  it('uses the single disk location even when folder tags are plural', () => {
    const shared = makeAsset({
      file_path: 'models/extra/foo.safetensors',
      tags: ['models', 'checkpoints', 'loras']
    })
    expect(directoryForAsset(shared)).toBe('extra')
  })

  it('falls back to metadata paths, then the folder tag', () => {
    expect(
      directoryForAsset(
        makeAsset({ metadata: { filepath: 'loras/flux1/foo.safetensors' } })
      )
    ).toBe('loras/flux1')
    expect(
      directoryForAsset(makeAsset({ tags: ['models', 'checkpoints'] }))
    ).toBe('checkpoints')
  })

  it('returns null when nothing locates the asset', () => {
    expect(directoryForAsset(makeAsset({ tags: ['models'] }))).toBeNull()
  })
})

describe('placeAssetsInGroups', () => {
  it('preserves sub-folder paths below the group root', () => {
    const ghibli = makeAsset({
      id: 'g',
      tags: ['models', 'loras/anime/ghibli']
    })
    const { byGroup } = placeAssetsInGroups([ghibli])
    expect(byGroup.get('loras')).toEqual([
      { asset: ghibli, subpath: 'anime/ghibli' }
    ])
  })

  it('keeps only the deepest path when a parent folder is also tagged', () => {
    const asset = makeAsset({
      id: 'a',
      tags: ['models', 'checkpoints/sdxl', 'checkpoints']
    })
    const { byGroup } = placeAssetsInGroups([asset])
    expect(byGroup.get('diffusion')).toEqual([{ asset, subpath: 'sdxl' }])
  })

  it('keeps the disk root as the first level when a group merges several roots', () => {
    const checkpoint = makeAsset({
      id: 'c',
      tags: ['models', 'checkpoints/sdxl']
    })
    const diffusion = makeAsset({
      id: 'd',
      tags: ['models', 'diffusion_models/sdxl']
    })
    const { byGroup } = placeAssetsInGroups([checkpoint, diffusion])
    expect(byGroup.get('diffusion')).toEqual([
      { asset: checkpoint, subpath: 'checkpoints/sdxl' },
      { asset: diffusion, subpath: 'diffusion_models/sdxl' }
    ])
  })

  it('places multi-tagged assets in every mapped group with their own subpath', () => {
    const shared = makeAsset({
      id: 's',
      tags: ['models', 'checkpoints', 'loras/shared']
    })
    const { byGroup } = placeAssetsInGroups([shared])
    expect(byGroup.get('diffusion')).toEqual([{ asset: shared, subpath: '' }])
    expect(byGroup.get('loras')).toEqual([{ asset: shared, subpath: 'shared' }])
  })

  it('nests unmapped tags under their verbatim top-level folder', () => {
    const asset = makeAsset({
      id: 'u',
      tags: ['models', 'intrinsic_loras/sd15']
    })
    const { byGroup, unmappedByTag } = placeAssetsInGroups([asset])
    expect(byGroup.size).toBe(0)
    expect(unmappedByTag.get('intrinsic_loras')).toEqual([
      { asset, subpath: 'sd15' }
    ])
  })
})

describe('groupLabelForAsset', () => {
  it('uses the model group label when the asset maps to a known group', () => {
    expect(groupLabelForAsset(makeAsset({ tags: ['models', 'loras'] }))).toBe(
      'LoRAs'
    )
  })

  it('falls back to the verbatim folder name for an unmapped tag', () => {
    expect(
      groupLabelForAsset(makeAsset({ tags: ['models', 'kjnodes_fonts'] }))
    ).toBe('kjnodes_fonts')
  })
})
