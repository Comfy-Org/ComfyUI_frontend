import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import {
  firstNonModelsTag,
  groupIdForAsset,
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

describe('groupIdForAsset', () => {
  it('keeps cross-base file types (loras, vae, conditioning) in their bucket', () => {
    expect(groupIdForAsset(makeAsset({ tags: ['models', 'loras'] }))).toBe(
      'loras'
    )
    expect(groupIdForAsset(makeAsset({ tags: ['models', 'vae'] }))).toBe('vae')
    expect(groupIdForAsset(makeAsset({ tags: ['models', 'controlnet'] }))).toBe(
      'conditioning'
    )
  })

  it('routes vae-looking assets to the vae bucket even when tagged otherwise', () => {
    expect(
      groupIdForAsset(makeAsset({ tags: ['models', 'CogVideo/VAE'] }))
    ).toBe('vae')
  })

  it('lets a base-model category override the file-type bucket', () => {
    const asset = makeAsset({
      tags: ['models', 'text_encoders'],
      metadata: { base_model: 'SDXL' }
    })
    expect(groupIdForAsset(asset)).toBe('diffusion')
  })

  it('falls back to the tag-derived group when no base override applies', () => {
    expect(
      groupIdForAsset(makeAsset({ tags: ['models', 'text_encoders'] }))
    ).toBe('encoders')
  })

  it('returns null for an unmapped tag with no resolvable base', () => {
    expect(
      groupIdForAsset(makeAsset({ tags: ['models', 'totallyunknown'] }))
    ).toBeNull()
  })
})

describe('groupLabelForAsset', () => {
  it('uses the model group label when the asset maps to a known group', () => {
    expect(groupLabelForAsset(makeAsset({ tags: ['models', 'loras'] }))).toBe(
      'LoRAs'
    )
  })

  it('falls back to a formatted label for an unmapped tag', () => {
    expect(
      groupLabelForAsset(makeAsset({ tags: ['models', 'totallyunknown'] }))
    ).toBe('Totallyunknown')
  })
})
