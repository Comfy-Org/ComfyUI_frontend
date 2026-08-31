import { describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'

import { useFlatOutputAssetsGrouped } from './useFlatOutputAssetsGrouped'

const media: Ref<AssetItem[]> = ref([])

vi.mock('./useFlatOutputAssets', () => ({
  useFlatOutputAssets: () => ({
    media,
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
    ...overrides,
    id: overrides.id ?? 'asset-id',
    name: overrides.name ?? 'output.png',
    created_at: overrides.created_at ?? '2026-08-25T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-08-25T00:00:00.000Z',
    tags: overrides.tags ?? ['output']
  }
}

describe('useFlatOutputAssetsGrouped', () => {
  it('preserves one output card per job with the full loaded output group', () => {
    const first = asset({
      id: 'first',
      name: 'first.png',
      job_id: 'job-1',
      preview_url: '/view?filename=first.png&type=output&subfolder=nested',
      user_metadata: { nodeId: '7' }
    })
    const second = asset({
      id: 'second',
      name: 'second.mp4',
      mime_type: 'video/mp4',
      job_id: 'job-1'
    })
    media.value = [first, second, asset({ id: 'ungrouped' })]

    const grouped = useFlatOutputAssetsGrouped().media.value
    const metadata = getOutputAssetMetadata(grouped[0].user_metadata)

    expect(grouped.map((item) => item.id)).toEqual(['first', 'ungrouped'])
    expect(metadata).toMatchObject({
      jobId: 'job-1',
      nodeId: '7',
      subfolder: 'nested',
      outputCount: 2
    })
    expect(metadata?.allOutputs?.map((output) => output.filename)).toEqual([
      'first.png',
      'second.mp4'
    ])
    expect(metadata?.allOutputs?.map((output) => output.mediaType)).toEqual([
      'images',
      'video'
    ])
    expect(first.user_metadata).toEqual({ nodeId: '7' })
  })

  it('keeps distinct jobs in first-occurrence order', () => {
    media.value = [
      asset({ id: 'a', job_id: 'job-a' }),
      asset({ id: 'b', job_id: 'job-b' }),
      asset({ id: 'a-sibling', job_id: 'job-a' })
    ]

    expect(
      useFlatOutputAssetsGrouped().media.value.map((item) => item.id)
    ).toEqual(['a', 'b'])
  })
})
