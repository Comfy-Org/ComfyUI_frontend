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

  return {
    media: flatOutputAssets,
    loading: flatOutputLoading,
    error: flatOutputError,
    fetchMediaList: store.updateFlatOutputs,
    refresh: store.updateFlatOutputs,
    loadMore: store.loadMoreFlatOutputs,
    hasMore: flatOutputHasMore,
    isLoadingMore: flatOutputIsLoadingMore
  }
}
