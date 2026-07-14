import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { useFlatOutputAssetsGrouped } from './useFlatOutputAssetsGrouped'

const mediaRef: Ref<AssetItem[]> = ref([])

vi.mock('./useFlatOutputAssets', () => ({
  useFlatOutputAssets: () => ({
    media: mediaRef,
    loading: ref(false),
    error: ref(null),
    hasMore: ref(false),
    isLoadingMore: ref(false),
    fetchMediaList: vi.fn(),
    refresh: vi.fn(),
    loadMore: vi.fn()
  })
}))

function asset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-id',
    name: 'output.png',
    tags: ['output'],
    ...overrides
  }
}

describe('useFlatOutputAssetsGrouped', () => {
  it('collapses rows with the same job_id into a single representative', () => {
    mediaRef.value = [
      asset({ id: 'a', name: 'out1.png', job_id: 'job-1' }),
      asset({ id: 'b', name: 'out2.png', job_id: 'job-1' }),
      asset({ id: 'c', name: 'out3.png', job_id: 'job-1' }),
      asset({ id: 'd', name: 'solo.png', job_id: 'job-2' })
    ]

    const { media } = useFlatOutputAssetsGrouped()

    expect(media.value.map((a) => a.id)).toEqual(['a', 'd'])
  })

  it('exposes the group size as user_metadata.outputCount', () => {
    mediaRef.value = [
      asset({ id: 'a', job_id: 'job-1' }),
      asset({ id: 'b', job_id: 'job-1' }),
      asset({ id: 'c', job_id: 'job-1' }),
      asset({ id: 'd', job_id: 'job-2' })
    ]

    const { media } = useFlatOutputAssetsGrouped()

    expect(media.value[0].user_metadata?.outputCount).toBe(3)
    expect(media.value[0].user_metadata?.jobId).toBe('job-1')
    expect(media.value[1].user_metadata?.outputCount).toBe(1)
  })

  it('falls back to prompt_id when job_id is absent (legacy)', () => {
    mediaRef.value = [
      asset({ id: 'a', prompt_id: 'job-legacy' }),
      asset({ id: 'b', prompt_id: 'job-legacy' })
    ]

    const { media } = useFlatOutputAssetsGrouped()

    expect(media.value).toHaveLength(1)
    expect(media.value[0].user_metadata?.jobId).toBe('job-legacy')
    expect(media.value[0].user_metadata?.outputCount).toBe(2)
  })

  it('passes through rows that have neither job_id nor prompt_id', () => {
    mediaRef.value = [asset({ id: 'orphan-a' }), asset({ id: 'orphan-b' })]

    const { media } = useFlatOutputAssetsGrouped()

    expect(media.value.map((a) => a.id)).toEqual(['orphan-a', 'orphan-b'])
  })

  it('preserves the order of the first occurrence per job_id', () => {
    mediaRef.value = [
      asset({ id: 'a', job_id: 'job-A' }),
      asset({ id: 'b', job_id: 'job-B' }),
      asset({ id: 'c', job_id: 'job-A' }),
      asset({ id: 'd', job_id: 'job-C' })
    ]

    const { media } = useFlatOutputAssetsGrouped()

    expect(media.value.map((a) => a.id)).toEqual(['a', 'b', 'd'])
  })

  it('does not mutate the underlying assets', () => {
    const original = asset({ id: 'a', job_id: 'job-1' })
    mediaRef.value = [original, asset({ id: 'b', job_id: 'job-1' })]

    const { media } = useFlatOutputAssetsGrouped()
    void media.value

    expect(original.user_metadata).toBeUndefined()
  })
})
