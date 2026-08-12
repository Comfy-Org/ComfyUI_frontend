import { storeToRefs } from 'pinia'

import { useAssetsStore } from '@/stores/assetsStore'

import type { IAssetsProvider } from './IAssetsProvider'

export function useFlatOutputAssets(): IAssetsProvider {
  const store = useAssetsStore()
  const {
    flatOutputAssets,
    flatOutputLoading,
    flatOutputError,
    flatOutputHasMore,
    flatOutputIsLoadingMore
  } = storeToRefs(store)
  async function fetchMediaList() {
    await store.updateFlatOutputs()
    return flatOutputAssets.value
  }

  return {
    media: flatOutputAssets,
    loading: flatOutputLoading,
    error: flatOutputError,
    fetchMediaList,
    refresh: fetchMediaList,
    loadMore: store.loadMoreFlatOutputs,
    hasMore: flatOutputHasMore,
    isLoadingMore: flatOutputIsLoadingMore
  }
}
