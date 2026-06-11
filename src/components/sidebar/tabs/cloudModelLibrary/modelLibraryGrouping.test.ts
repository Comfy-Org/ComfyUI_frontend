import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import {
  directoryForAsset,
  firstNonModelsTag,
  groupAsset,
  groupLabelForAsset,
  looksLikeVae,
  partnerKind,
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

describe('looksLikeVae', () => {
  it('matches a "vae" path segment in the tag', () => {
    expect(looksLikeVae(makeAsset(), 'CogVideo/VAE')).toBe(true)
    expect(looksLikeVae(makeAsset(), 'foo/vae_approx')).toBe(true)
  })

  it('matches "vae" as a word in the filename', () => {
    expect(
      looksLikeVae(makeAsset({ name: 'model_vae_v1.safetensors' }), 'encoders')
    ).toBe(true)
  })

  it('does not match "vae" embedded inside another word', () => {
    expect(
      looksLikeVae(makeAsset({ name: 'levaeon.safetensors' }), 'encoders')
    ).toBe(false)
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

  it('routes vae-looking assets to the vae bucket even when tagged otherwise', () => {
    expect(
      groupAsset(makeAsset({ tags: ['models', 'CogVideo/VAE'] })).groupIds
    ).toEqual(['vae'])
  })

  it('lets a base-model category override the file-type bucket', () => {
    const asset = makeAsset({
      tags: ['models', 'text_encoders'],
      metadata: { base_model: 'SDXL' }
    })
    expect(groupAsset(asset).groupIds).toEqual(['diffusion'])
  })

  it('falls back to the tag-derived group when no base override applies', () => {
    expect(
      groupAsset(makeAsset({ tags: ['models', 'text_encoders'] })).groupIds
    ).toEqual(['encoders'])
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
