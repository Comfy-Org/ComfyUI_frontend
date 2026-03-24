import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { groupAssetsByPromptId } from './groupAssetsByPromptId'

function makeAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return { id: 'a', name: 'a.png', tags: [], ...overrides }
}

describe(groupAssetsByPromptId, () => {
  it('returns empty array for empty input', () => {
    expect(groupAssetsByPromptId([])).toEqual([])
  })

  it('groups assets sharing the same prompt_id and sets outputCount', () => {
    const assets = [
      makeAsset({ id: '1', prompt_id: 'p1', created_at: '2024-01-01' }),
      makeAsset({ id: '2', prompt_id: 'p1', created_at: '2024-01-01' }),
      makeAsset({ id: '3', prompt_id: 'p1', created_at: '2024-01-01' })
    ]

    const result = groupAssetsByPromptId(assets)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
    expect(result[0].user_metadata?.outputCount).toBe(3)
  })

  it('treats assets with null prompt_id individually keyed by id', () => {
    const assets = [
      makeAsset({ id: 'a1', prompt_id: null, created_at: '2024-01-01' }),
      makeAsset({ id: 'a2', prompt_id: null, created_at: '2024-01-02' })
    ]

    const result = groupAssetsByPromptId(assets)

    expect(result).toHaveLength(2)
    expect(result.every((a) => a.user_metadata?.outputCount === 1)).toBe(true)
  })

  it('sets outputCount to 1 for single-asset groups', () => {
    const assets = [
      makeAsset({ id: '1', prompt_id: 'p1' }),
      makeAsset({ id: '2', prompt_id: 'p2' })
    ]

    const result = groupAssetsByPromptId(assets)

    expect(result).toHaveLength(2)
    expect(result[0].user_metadata?.outputCount).toBe(1)
    expect(result[1].user_metadata?.outputCount).toBe(1)
  })

  it('sorts results by created_at descending', () => {
    const assets = [
      makeAsset({ id: '1', prompt_id: 'p1', created_at: '2024-01-01' }),
      makeAsset({ id: '2', prompt_id: 'p2', created_at: '2024-03-01' }),
      makeAsset({ id: '3', prompt_id: 'p3', created_at: '2024-02-01' })
    ]

    const result = groupAssetsByPromptId(assets)

    expect(result.map((a) => a.id)).toEqual(['2', '3', '1'])
  })
})
