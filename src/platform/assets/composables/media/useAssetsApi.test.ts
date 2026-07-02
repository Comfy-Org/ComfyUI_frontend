import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsApi } from './useAssetsApi'

const mockAssetsStore = vi.hoisted(() => ({
  inputAssets: [] as AssetItem[],
  historyAssets: [] as AssetItem[],
  inputLoading: false,
  historyLoading: false,
  inputError: null as string | null,
  historyError: null as string | null,
  hasMoreHistory: false,
  isLoadingMore: false,
  updateInputs: vi.fn(),
  updateHistory: vi.fn(),
  loadMoreHistory: vi.fn()
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => mockAssetsStore
}))

function createAsset(id: string): AssetItem {
  return {
    id,
    name: `${id}.png`,
    size: 1,
    created_at: '2026-01-01T00:00:00Z',
    tags: ['input']
  }
}

describe('useAssetsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssetsStore.inputAssets = [createAsset('input-1')]
    mockAssetsStore.historyAssets = [createAsset('history-1')]
    mockAssetsStore.inputLoading = true
    mockAssetsStore.historyLoading = false
    mockAssetsStore.inputError = 'input-error'
    mockAssetsStore.historyError = 'history-error'
    mockAssetsStore.hasMoreHistory = true
    mockAssetsStore.isLoadingMore = true
  })

  it('uses input assets and refreshes inputs', async () => {
    const api = useAssetsApi('input')

    expect(api.media.value).toEqual([createAsset('input-1')])
    expect(api.loading.value).toBe(true)
    expect(api.error.value).toBe('input-error')
    expect(api.hasMore.value).toBe(false)
    expect(api.isLoadingMore.value).toBe(false)

    await expect(api.fetchMediaList()).resolves.toEqual([
      createAsset('input-1')
    ])
    await expect(api.refresh()).resolves.toEqual([createAsset('input-1')])
    await api.loadMore()

    expect(mockAssetsStore.updateInputs).toHaveBeenCalledTimes(2)
    expect(mockAssetsStore.updateHistory).not.toHaveBeenCalled()
    expect(mockAssetsStore.loadMoreHistory).not.toHaveBeenCalled()
  })

  it('uses output history and loads more history', async () => {
    const api = useAssetsApi('output')

    expect(api.media.value).toEqual([createAsset('history-1')])
    expect(api.loading.value).toBe(false)
    expect(api.error.value).toBe('history-error')
    expect(api.hasMore.value).toBe(true)
    expect(api.isLoadingMore.value).toBe(true)

    await expect(api.fetchMediaList()).resolves.toEqual([
      createAsset('history-1')
    ])
    await api.loadMore()

    expect(mockAssetsStore.updateHistory).toHaveBeenCalledOnce()
    expect(mockAssetsStore.updateInputs).not.toHaveBeenCalled()
    expect(mockAssetsStore.loadMoreHistory).toHaveBeenCalledOnce()
  })
})
