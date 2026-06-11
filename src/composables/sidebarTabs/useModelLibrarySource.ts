import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { MODELS_TAG } from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'

// Model Library data source. Reads the assets API on every distribution —
// the library assumes an assets-enabled backend and renders whatever it
// serves; behavioral differences come from the data, not the distribution.

export interface ModelLibrarySource {
  assets: ComputedRef<AssetItem[]>
  isLoading: ComputedRef<boolean> | Ref<boolean>
  refresh: () => Promise<void>
}

const CACHE_KEY = `tag:${MODELS_TAG}`

export function useModelLibrarySource(): ModelLibrarySource {
  const assetsStore = useAssetsStore()

  async function refresh(): Promise<void> {
    await assetsStore.updateModelsForTag(MODELS_TAG)
  }

  const assets = computed<AssetItem[]>(() => assetsStore.getAssets(CACHE_KEY))
  const isLoading = computed(
    () => assetsStore.isModelLoading(CACHE_KEY) && assets.value.length === 0
  )

  return { assets, isLoading, refresh }
}
