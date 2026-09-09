import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { UNKNOWN_PROVIDER, getAssetProvider } from './modelGroups'

function makeAsset(metadata: Record<string, unknown>): AssetItem {
  return { metadata } as unknown as AssetItem
}

describe('getAssetProvider', () => {
  it('returns the override when the repo_id is a known Comfy-Org repackage', () => {
    expect(
      getAssetProvider(
        makeAsset({ repo_id: 'Comfy-Org/Wan_2.2_ComfyUI_Repackaged' })
      )
    ).toBe('Wan-AI')

    expect(
      getAssetProvider(makeAsset({ repo_id: 'Comfy-Org/flux1-dev' }))
    ).toBe('black-forest-labs')
  })

  it('falls back to the bare org for Comfy-Org repos without an override', () => {
    expect(getAssetProvider(makeAsset({ repo_id: 'Comfy-Org/SDPose' }))).toBe(
      'Comfy-Org'
    )
  })

  it('returns the org prefix verbatim for non-Comfy-Org repos', () => {
    expect(
      getAssetProvider(makeAsset({ repo_id: 'black-forest-labs/FLUX.1-dev' }))
    ).toBe('black-forest-labs')
  })

  it('falls back to user_metadata.repo_id when metadata is missing', () => {
    const asset = {
      metadata: {},
      user_metadata: { repo_id: 'Comfy-Org/TRELLIS.2' }
    } as unknown as AssetItem
    expect(getAssetProvider(asset)).toBe('microsoft')
  })

  it('returns the unknown sentinel when no repo_id is available', () => {
    expect(getAssetProvider(makeAsset({}))).toBe(UNKNOWN_PROVIDER)
  })
})
