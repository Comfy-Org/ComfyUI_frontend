import { computed, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'

import type { IAssetsProvider } from './IAssetsProvider'

const PAGE_SIZE = 200
const OUTPUT_TAG = 'output'

/**
 * Cloud-only output provider.
 *
 * Cloud stores every output as its own row in the assets table tagged
 * `output`, so listing outputs is a single paginated GET — the per-job
 * detail walk used by the history-based path is unnecessary here.
 */
export function useFlatOutputAssets(): IAssetsProvider {
  const media = ref<AssetItem[]>([])
  const loading = ref(false)
  const error = ref<unknown>(null)
  const offset = ref(0)
  const hasMore = ref(true)
  const isLoadingMore = ref(false)
  const seenIds = new Set<string>()

  const fetchMediaList = async (): Promise<AssetItem[]> => {
    loading.value = true
    error.value = null
    offset.value = 0
    hasMore.value = true
    seenIds.clear()
    try {
      const assets = await assetService.getAssetsByTag(OUTPUT_TAG, true, {
        limit: PAGE_SIZE,
        offset: 0
      })
      for (const asset of assets) seenIds.add(asset.id)
      media.value = assets
      hasMore.value = assets.length === PAGE_SIZE
      offset.value = assets.length
      return assets
    } catch (err) {
      error.value = err
      console.error('Failed to fetch output assets:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  const refresh = () => fetchMediaList()

  const loadMore = async (): Promise<void> => {
    if (!hasMore.value || isLoadingMore.value) return
    isLoadingMore.value = true
    error.value = null
    try {
      const next = await assetService.getAssetsByTag(OUTPUT_TAG, true, {
        limit: PAGE_SIZE,
        offset: offset.value
      })
      const fresh = next.filter((asset) => !seenIds.has(asset.id))
      for (const asset of fresh) seenIds.add(asset.id)
      if (fresh.length) media.value = [...media.value, ...fresh]
      hasMore.value = next.length === PAGE_SIZE
      offset.value += next.length
    } catch (err) {
      error.value = err
      console.error('Failed to load more output assets:', err)
    } finally {
      isLoadingMore.value = false
    }
  }

  return {
    media,
    loading,
    error,
    fetchMediaList,
    refresh,
    loadMore,
    hasMore,
    isLoadingMore: computed(() => isLoadingMore.value)
  }
}
