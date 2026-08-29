import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { PagedList } from '@/utils/pagedList'

const query = vi.hoisted(() => ({
  current: undefined as PagedList<AssetItem> | undefined
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: { assetsEnabled: true } })
}))

vi.mock('@/platform/assets/composables/useAssetsQuery', () => ({
  invalidateAll: vi.fn(),
  useAssetsQuery: vi.fn(() => query.current)
}))

vi.mock('@/stores/assetDownloadStore', () => ({
  useAssetDownloadStore: () => ({})
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({})
}))

import { useAssetsStore } from '@/stores/assetsStore'

function asset(id: string): AssetItem {
  return {
    id,
    name: `${id}.png`,
    size: 1,
    created_at: '2026-08-29T00:00:00Z',
    updated_at: '2026-08-29T00:00:00Z',
    tags: ['output']
  }
}

function pagedList(
  items: AssetItem[],
  loadMore: () => Promise<boolean>,
  hasMore = ref(true)
): PagedList<AssetItem> {
  return {
    hasMore,
    invalidate: vi.fn(),
    isLoading: ref(false),
    items: ref(items),
    loadMore,
    loadNew: vi.fn()
  }
}

describe('assetsStore output lookup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads pages until the requested output is found', async () => {
    const items = ref([asset('first-page')])
    const loadMore = vi.fn(async () => {
      items.value.push(
        loadMore.mock.calls.length === 2
          ? asset('requested-output')
          : asset('second-page')
      )
      return true
    })
    query.current = {
      ...pagedList([], loadMore),
      items
    }

    const found = await useAssetsStore().loadOutputAsset('requested-output')

    expect(found).toBe(true)
    expect(loadMore).toHaveBeenCalledTimes(2)
  })

  it('stops when pagination cannot advance to the requested output', async () => {
    const loadMore = vi.fn(async () => false)
    query.current = pagedList([], loadMore)

    const found = await useAssetsStore().loadOutputAsset('missing-output')

    expect(found).toBe(false)
    expect(loadMore).toHaveBeenCalledOnce()
  })
})
