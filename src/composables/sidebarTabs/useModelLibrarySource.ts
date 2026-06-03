import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { MODELS_TAG } from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { isCloud } from '@/platform/distribution/types'
import { useAssetsStore } from '@/stores/assetsStore'

import { useLocalModelLibrarySource } from './useLocalModelLibrarySource'

// Unified Model Library data source. The cloud distribution reads from the
// assets API via useAssetsStore; desktop and localhost distributions enumerate
// the on-disk models folder. Consumers see the same AssetItem[] shape either
// way so the sidebar component renders without branching on mode.

export interface ModelLibrarySource {
  assets: ComputedRef<AssetItem[]>
  isLoading: ComputedRef<boolean> | Ref<boolean>
  refresh: () => Promise<void>
}

const CLOUD_CACHE_KEY = `tag:${MODELS_TAG}`

export function useModelLibrarySource(): ModelLibrarySource {
  if (!isCloud) {
    return useLocalModelLibrarySource()
  }

  const assetsStore = useAssetsStore()

  async function refresh(): Promise<void> {
    await assetsStore.updateModelsForTag(MODELS_TAG)
  }

  const assets = computed<AssetItem[]>(() =>
    assetsStore.getAssets(CLOUD_CACHE_KEY)
  )
  const isLoading = computed(
    () =>
      assetsStore.isModelLoading(CLOUD_CACHE_KEY) && assets.value.length === 0
  )

  return { assets, isLoading, refresh }
}
