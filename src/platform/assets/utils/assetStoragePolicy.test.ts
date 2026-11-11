import { describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@comfyorg/assets-core/schema'

import { getAssetStoredFilename } from './assetStoragePolicy'

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

describe('getAssetStoredFilename', () => {
  it.for([
    { cloud: true, hash: 'hash123', expected: 'hash123' },
    { cloud: true, hash: undefined, expected: 'test-model' },
    { cloud: false, hash: 'hash123', expected: 'test-model' }
  ])(
    'returns $expected with cloud=$cloud and hash=$hash',
    ({ cloud, hash, expected }) => {
      distribution.isCloud = cloud
      const asset: AssetItem = {
        id: 'test-id',
        name: 'test-model',
        hash,
        size: 1024,
        tags: ['models', 'checkpoints'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      expect(getAssetStoredFilename(asset)).toBe(expected)
    }
  )
})
