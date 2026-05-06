import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  OUTPUT_TAG,
  assetService
} from '@/platform/assets/services/assetService'

import type { IAssetsProvider } from './IAssetsProvider'

const PAGE_SIZE = 200

/**
 * Cloud-only output provider, singleton across all callers.
 *
 * Cloud stores every output as its own row in the assets table tagged
 * `output`, so listing outputs is a single paginated GET — the per-job
 * detail walk used by the history-based path is unnecessary here.
 *
 * State is module-scoped so multiple `WidgetSelectDropdown` instances on
 * the same canvas share one fetch and one cache, mirroring how the
 * history path shares state via the Pinia `assetsStore`.
 */
const media = ref<AssetItem[]>([])
const loading = ref(false)
const error = ref<unknown>(null)
const offset = ref(0)
const hasMore = ref(true)
const isLoadingMore = ref(false)
const seenIds = new Set<string>()
let inFlight: Promise<AssetItem[]> | null = null

async function fetchPage(loadMore: boolean): Promise<AssetItem[]> {
  if (inFlight) return inFlight

  if (loadMore) {
    if (!hasMore.value) return media.value
    isLoadingMore.value = true
  } else {
    loading.value = true
    offset.value = 0
    hasMore.value = true
    seenIds.clear()
  }
  error.value = null

  inFlight = (async () => {
    try {
      const page = await assetService.getAssetsByTag(OUTPUT_TAG, true, {
        limit: PAGE_SIZE,
        offset: offset.value
      })
      const fresh = loadMore
        ? page.filter((asset) => !seenIds.has(asset.id))
        : page
      for (const asset of fresh) seenIds.add(asset.id)
      media.value = loadMore ? [...media.value, ...fresh] : page
      offset.value += page.length
      hasMore.value = page.length === PAGE_SIZE
      return media.value
    } catch (err) {
      error.value = err
      console.error('Failed to fetch output assets:', err)
      return loadMore ? media.value : []
    } finally {
      if (loadMore) isLoadingMore.value = false
      else loading.value = false
      inFlight = null
    }
  })()

  return inFlight
}

export function useFlatOutputAssets(): IAssetsProvider {
  return {
    media,
    loading,
    error,
    fetchMediaList: () => fetchPage(false),
    refresh: () => fetchPage(false),
    loadMore: async () => {
      if (isLoadingMore.value) return
      await fetchPage(true)
    },
    hasMore,
    isLoadingMore
  }
}

/**
 * Test seam: reset the singleton state between tests so each test gets a
 * clean slate. Production code should not call this.
 */
export function _resetForTests() {
  media.value = []
  loading.value = false
  error.value = null
  offset.value = 0
  hasMore.value = true
  isLoadingMore.value = false
  seenIds.clear()
  inFlight = null
}
