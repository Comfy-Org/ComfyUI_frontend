import { computed } from 'vue'

import { useAssetsStore } from '@/stores/assetsStore'

/**
 * Composable for fetching media assets from cloud environment
 * Uses AssetsStore for centralized state management
 */
export function useAssetsApi(directory: 'input' | 'output') {
  const assetsStore = useAssetsStore()

  const media = computed(() =>
    directory === 'input' ? assetsStore.inputAssets : assetsStore.historyAssets
  )

  const loading = computed(() =>
    directory === 'input'
      ? assetsStore.inputLoading
      : assetsStore.historyLoading
  )

  const error = computed(() =>
    directory === 'input' ? assetsStore.inputError : assetsStore.historyError
  )

  const fetchMediaList = async (): Promise<void> => {
    if (directory === 'input') {
      await assetsStore.updateInputs()
    } else {
      await assetsStore.updateHistory()
    }
  }

  const refresh = () => fetchMediaList()

  const loadMore = async (): Promise<void> => {
    if (directory === 'output') {
      await assetsStore.loadMoreHistory()
    }
  }

  const hasMore = computed(() => {
    return directory === 'output' ? assetsStore.hasMoreHistory : false
  })

  const isLoadingMore = computed(() => {
    return directory === 'output' ? assetsStore.isLoadingMore : false
  })

  return {
    media,
    loading,
    error,
    fetchMediaList,
    refresh,
    loadMore,
    hasMore,
    isLoadingMore
  }
}
