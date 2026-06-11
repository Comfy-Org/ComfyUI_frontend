import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import {
  directoryForAsset,
  firstNonModelsTag,
  groupAsset,
  groupLabelForAsset,
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

  it('keeps companion file types in their bucket regardless of base model', () => {
    const clipEncoder = makeAsset({
      tags: ['models', 'text_encoders'],
      metadata: { base_model: 'SDXL' }
    })
    expect(groupAsset(clipEncoder).groupIds).toEqual(['encoders'])
    const upscaler = makeAsset({
      tags: ['models', 'latent_upscale_models'],
      metadata: { base_model: 'LTX 2.3' }
    })
    expect(groupAsset(upscaler).groupIds).toEqual(['upscale'])
  })

  it('re-homes main generative models into their modality by base model', () => {
    const videoTransformer = makeAsset({
      tags: ['models', 'diffusion_models'],
      metadata: { base_model: 'LTX 2.3' }
    })
    expect(groupAsset(videoTransformer).groupIds).toEqual(['video'])
    const audioCheckpoint = makeAsset({
      tags: ['models', 'checkpoints'],
      metadata: { base_model: 'ACE-Step' }
    })
    expect(groupAsset(audioCheckpoint).groupIds).toEqual(['audio'])
  })

  it('falls back to the tag-derived group when no base override applies', () => {
    expect(
      groupAsset(makeAsset({ tags: ['models', 'text_encoders'] })).groupIds
    ).toEqual(['encoders'])
  })

  it('does not capture unmapped tags by base model', () => {
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
