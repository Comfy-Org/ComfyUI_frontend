import { useAsyncState, whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowReactive } from 'vue'
import {
  mapInputFileToAssetItem,
  mapTaskOutputToAssetItem
} from '@/platform/assets/composables/media/assetMappers'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import type { PaginationOptions } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'

import { TaskItemImpl } from './queueStore'
import { useAssetDownloadStore } from './assetDownloadStore'
import { useModelToNodeStore } from './modelToNodeStore'

const INPUT_LIMIT = 100

/**
 * Fetch input files from the internal API (OSS version)
 */
async function fetchInputFilesFromAPI(): Promise<AssetItem[]> {
  const response = await fetch(api.internalURL('/files/input'), {
    headers: {
      'Comfy-User': api.user
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch input files')
  }

  const filenames: string[] = await response.json()
  return filenames.map((name, index) =>
    mapInputFileToAssetItem(name, index, 'input')
  )
}

/**
 * Fetch input files from cloud service
 */
async function fetchInputFilesFromCloud(): Promise<AssetItem[]> {
  return await assetService.getAssetsByTag('input', false, {
    limit: INPUT_LIMIT
  })
}

/**
 * Convert history job items to asset items
 */
function mapHistoryToAssets(historyItems: JobListItem[]): AssetItem[] {
  const assetItems: AssetItem[] = []

  for (const job of historyItems) {
    // Only process completed jobs with preview output
    if (job.status !== 'completed' || !job.preview_output) {
      continue
    }

    const task = new TaskItemImpl(job)

    if (!task.previewOutput) {
      continue
    }

    const assetItem = mapTaskOutputToAssetItem(task, task.previewOutput)

    assetItem.user_metadata = {
      ...assetItem.user_metadata,
      outputCount: job.outputs_count,
      allOutputs: task.previewableOutputs
    }

    assetItems.push(assetItem)
  }

  return assetItems.sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime()
  )
}

const BATCH_SIZE = 200
const MAX_HISTORY_ITEMS = 1000 // Maximum items to keep in memory

export const useAssetsStore = defineStore('assets', () => {
  const assetDownloadStore = useAssetDownloadStore()
  const modelToNodeStore = useModelToNodeStore()

  // Pagination state
  const historyOffset = ref(0)
  const hasMoreHistory = ref(true)
  const isLoadingMore = ref(false)

  const allHistoryItems = ref<AssetItem[]>([])

  const loadedIds = shallowReactive(new Set<string>())

  const fetchInputFiles = isCloud
    ? fetchInputFilesFromCloud
    : fetchInputFilesFromAPI

  const {
    state: inputAssets,
    isLoading: inputLoading,
    error: inputError,
    execute: updateInputs
  } = useAsyncState(fetchInputFiles, [], {
    immediate: false,
    resetOnExecute: false,
    onError: (err) => {
      console.error('Error fetching input assets:', err)
    }
  })

  /**
   * Fetch history assets with pagination support
   * @param loadMore - true for pagination (append), false for initial load (replace)
   */
  const fetchHistoryAssets = async (loadMore = false): Promise<AssetItem[]> => {
    // Reset state for initial load
    if (!loadMore) {
      historyOffset.value = 0
      hasMoreHistory.value = true
      allHistoryItems.value = []
      loadedIds.clear()
    }

    // Fetch from server with offset
    const history = await api.getHistory(BATCH_SIZE, {
      offset: historyOffset.value
    })

    // Convert JobListItems to AssetItems
    const newAssets = mapHistoryToAssets(history)

    if (loadMore) {
      // Filter out duplicates and insert in sorted order
      for (const asset of newAssets) {
        if (loadedIds.has(asset.id)) {
          continue // Skip duplicates
        }
        loadedIds.add(asset.id)

        // Find insertion index to maintain sorted order (newest first)
        const assetTime = new Date(asset.created_at ?? 0).getTime()
        const insertIndex = allHistoryItems.value.findIndex(
          (item) => new Date(item.created_at ?? 0).getTime() < assetTime
        )

        if (insertIndex === -1) {
          // Asset is oldest, append to end
          allHistoryItems.value.push(asset)
        } else {
          // Insert at the correct position
          allHistoryItems.value.splice(insertIndex, 0, asset)
        }
      }
    } else {
      // Initial load: replace all
      allHistoryItems.value = newAssets
      newAssets.forEach((asset) => loadedIds.add(asset.id))
    }

    // Update pagination state
    historyOffset.value += BATCH_SIZE
    hasMoreHistory.value = history.length === BATCH_SIZE

    if (allHistoryItems.value.length > MAX_HISTORY_ITEMS) {
      const removed = allHistoryItems.value.slice(MAX_HISTORY_ITEMS)
      allHistoryItems.value = allHistoryItems.value.slice(0, MAX_HISTORY_ITEMS)

      // Clean up Set
      removed.forEach((item) => loadedIds.delete(item.id))
    }

    return allHistoryItems.value
  }

  const historyAssets = ref<AssetItem[]>([])
  const historyLoading = ref(false)
  const historyError = ref<unknown>(null)

  /**
   * Initial load of history assets
   */
  const updateHistory = async () => {
    historyLoading.value = true
    historyError.value = null
    try {
      await fetchHistoryAssets(false)
      historyAssets.value = allHistoryItems.value
    } catch (err) {
      console.error('Error fetching history assets:', err)
      historyError.value = err
      // Keep existing data when error occurs
      if (!historyAssets.value.length) {
        historyAssets.value = []
      }
    } finally {
      historyLoading.value = false
    }
  }

  /**
   * Load more history items (infinite scroll)
   */
  const loadMoreHistory = async () => {
    // Guard: prevent concurrent loads and check if more items available
    if (!hasMoreHistory.value || isLoadingMore.value) return

    isLoadingMore.value = true
    historyError.value = null

    try {
      await fetchHistoryAssets(true)
      historyAssets.value = allHistoryItems.value
    } catch (err) {
      console.error('Error loading more history:', err)
      historyError.value = err
      // Keep existing data when error occurs (consistent with updateHistory)
      if (!historyAssets.value.length) {
        historyAssets.value = []
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  /**
   * Map of asset hash filename to asset item for O(1) lookup
   * Cloud assets use asset_hash for the hash-based filename
   */
  const inputAssetsByFilename = computed(() => {
    const map = new Map<string, AssetItem>()
    for (const asset of inputAssets.value) {
      if (asset.asset_hash) {
        map.set(asset.asset_hash, asset)
      }
    }
    return map
  })

  /**
   * @param filename Hash-based filename (e.g., "72e786ff...efb7.png")
   * @returns Human-readable asset name or original filename if not found
   */
  function getInputName(filename: string): string {
    return inputAssetsByFilename.value.get(filename)?.name ?? filename
  }

  const MODEL_BATCH_SIZE = 500

  interface ModelPaginationState {
    assets: Map<string, AssetItem>
    offset: number
    hasMore: boolean
    isLoading: boolean
    error?: Error
  }

  /**
   * Model assets cached by node type (e.g., 'CheckpointLoaderSimple', 'LoraLoader')
   * Used by multiple loader nodes to avoid duplicate fetches
   * Cloud-only feature - empty Maps in desktop builds
   */
  const getModelState = () => {
    if (isCloud) {
      const modelStateByKey = ref(new Map<string, ModelPaginationState>())

      const assetsArrayCache = new Map<
        string,
        { source: Map<string, AssetItem>; array: AssetItem[] }
      >()

      const pendingRequestByKey = new Map<string, ModelPaginationState>()

      function createState(): ModelPaginationState {
        return reactive({
          assets: new Map(),
          offset: 0,
          hasMore: true,
          isLoading: false
        })
      }

      function isStale(key: string, state: ModelPaginationState): boolean {
        const committed = modelStateByKey.value.get(key)
        const pending = pendingRequestByKey.get(key)
        return committed !== state && pending !== state
      }

      const EMPTY_ASSETS: AssetItem[] = []

      function getAssets(key: string): AssetItem[] {
        const state = modelStateByKey.value.get(key)
        const assetsMap = state?.assets
        if (!assetsMap) return EMPTY_ASSETS

        const cached = assetsArrayCache.get(key)
        if (cached && cached.source === assetsMap) {
          return cached.array
        }

        const array = Array.from(assetsMap.values())
        assetsArrayCache.set(key, { source: assetsMap, array })
        return array
      }

      function isLoading(key: string): boolean {
        return modelStateByKey.value.get(key)?.isLoading ?? false
      }

      function getError(key: string): Error | undefined {
        return modelStateByKey.value.get(key)?.error
      }

      function hasMore(key: string): boolean {
        return modelStateByKey.value.get(key)?.hasMore ?? false
      }

      function hasAssetKey(key: string): boolean {
        return modelStateByKey.value.has(key)
      }

      /**
       * Internal helper to fetch and cache assets with a given key and fetcher.
       * Loads first batch immediately, then progressively loads remaining batches.
       * Keeps existing data visible until new data is successfully fetched.
       */
      async function updateModelsForKey(
        key: string,
        fetcher: (options: PaginationOptions) => Promise<AssetItem[]>
      ): Promise<void> {
        const state = createState()
        state.isLoading = true

        const hasExistingData = modelStateByKey.value.has(key)
        if (hasExistingData) {
          pendingRequestByKey.set(key, state)
        } else {
          modelStateByKey.value.set(key, state)
        }

        async function loadBatches(): Promise<void> {
          while (state.hasMore) {
            try {
              const newAssets = await fetcher({
                limit: MODEL_BATCH_SIZE,
                offset: state.offset
              })

              if (isStale(key, state)) return

              const isFirstBatch = state.offset === 0
              if (isFirstBatch) {
                assetsArrayCache.delete(key)
                if (hasExistingData) {
                  pendingRequestByKey.delete(key)
                  modelStateByKey.value.set(key, state)
                }
                state.assets = new Map(newAssets.map((a) => [a.id, a]))
              } else {
                const assetsToAdd = newAssets.filter(
                  (a) => !state.assets.has(a.id)
                )
                if (assetsToAdd.length > 0) {
                  assetsArrayCache.delete(key)
                  for (const asset of assetsToAdd) {
                    state.assets.set(asset.id, asset)
                  }
                }
              }

              state.offset += newAssets.length
              state.hasMore = newAssets.length === MODEL_BATCH_SIZE

              if (isFirstBatch) {
                state.isLoading = false
              }

              if (state.hasMore) {
                await new Promise((resolve) => setTimeout(resolve, 50))
              }
            } catch (err) {
              if (isStale(key, state)) return
              state.error = err instanceof Error ? err : new Error(String(err))
              state.hasMore = false
              console.error(`Error loading batch for ${key}:`, err)
              if (state.offset === 0) {
                state.isLoading = false
                pendingRequestByKey.delete(key)
                // TODO: Add toast indicator for first-batch load failures
              }
              return
            }
          }
        }

        await loadBatches()
      }

      /**
       * Fetch and cache model assets for a specific node type
       * @param nodeType The node type to fetch assets for (e.g., 'CheckpointLoaderSimple')
       */
      async function updateModelsForNodeType(nodeType: string): Promise<void> {
        await updateModelsForKey(nodeType, (opts) =>
          assetService.getAssetsForNodeType(nodeType, opts)
        )
      }

      /**
       * Fetch and cache model assets for a specific tag
       * @param tag The tag to fetch assets for (e.g., 'models')
       */
      async function updateModelsForTag(tag: string): Promise<void> {
        const key = `tag:${tag}`
        await updateModelsForKey(key, (opts) =>
          assetService.getAssetsByTag(tag, true, opts)
        )
      }

      /**
       * Optimistically update an asset in the cache
       * @param assetId The asset ID to update
       * @param updates Partial asset data to merge
       * @param cacheKey Optional cache key to target (nodeType or 'tag:xxx')
       */
      function updateAssetInCache(
        assetId: string,
        updates: Partial<AssetItem>,
        cacheKey?: string
      ) {
        const keysToCheck = cacheKey
          ? [cacheKey]
          : Array.from(modelStateByKey.value.keys())

        for (const key of keysToCheck) {
          const state = modelStateByKey.value.get(key)
          if (!state?.assets) continue

          const existingAsset = state.assets.get(assetId)
          if (existingAsset) {
            const updatedAsset = { ...existingAsset, ...updates }
            state.assets.set(assetId, updatedAsset)
            assetsArrayCache.delete(key)
            if (cacheKey) return
          }
        }
      }

      /**
       * Update asset metadata with optimistic cache update
       * @param assetId The asset ID to update
       * @param userMetadata The user_metadata to save
       * @param cacheKey Optional cache key to target for optimistic update
       */
      async function updateAssetMetadata(
        assetId: string,
        userMetadata: Record<string, unknown>,
        cacheKey?: string
      ) {
        updateAssetInCache(assetId, { user_metadata: userMetadata }, cacheKey)
        await assetService.updateAsset(assetId, { user_metadata: userMetadata })
      }

      /**
       * Update asset tags with optimistic cache update
       * @param assetId The asset ID to update
       * @param tags The tags array to save
       * @param cacheKey Optional cache key to target for optimistic update
       */
      async function updateAssetTags(
        assetId: string,
        tags: string[],
        cacheKey?: string
      ) {
        updateAssetInCache(assetId, { tags }, cacheKey)
        await assetService.updateAsset(assetId, { tags })
      }

      return {
        getAssets,
        isLoading,
        getError,
        hasMore,
        hasAssetKey,
        updateModelsForNodeType,
        updateModelsForTag,
        updateAssetMetadata,
        updateAssetTags
      }
    }

    const emptyAssets: AssetItem[] = []
    return {
      getAssets: () => emptyAssets,
      isLoading: () => false,
      getError: () => undefined,
      hasMore: () => false,
      hasAssetKey: () => false,
      updateModelsForNodeType: async () => {},
      updateModelsForTag: async () => {},
      updateAssetMetadata: async () => {},
      updateAssetTags: async () => {}
    }
  }

  const {
    getAssets,
    isLoading: isModelLoading,
    getError,
    hasMore,
    hasAssetKey,
    updateModelsForNodeType,
    updateModelsForTag,
    updateAssetMetadata,
    updateAssetTags
  } = getModelState()

  // Watch for completed downloads and refresh model caches
  whenever(
    () => assetDownloadStore.lastCompletedDownload,
    async (latestDownload) => {
      const { modelType } = latestDownload

      const providers = modelToNodeStore
        .getAllNodeProviders(modelType)
        .filter((provider) => provider.nodeDef?.name)

      const nodeTypeUpdates = providers.map((provider) =>
        updateModelsForNodeType(provider.nodeDef.name).then(
          () => provider.nodeDef.name
        )
      )

      // Also update by tag in case modal was opened with assetType
      const tagUpdates = [
        updateModelsForTag(modelType),
        updateModelsForTag('models')
      ]

      const results = await Promise.allSettled([
        ...nodeTypeUpdates,
        ...tagUpdates
      ])

      for (const result of results) {
        if (result.status === 'rejected') {
          console.error(
            `Failed to refresh model cache for provider: ${result.reason}`
          )
        }
      }
    }
  )

  return {
    // States
    inputAssets,
    historyAssets,
    inputLoading,
    historyLoading,
    inputError,
    historyError,
    hasMoreHistory,
    isLoadingMore,

    // Actions
    updateInputs,
    updateHistory,
    loadMoreHistory,

    // Input mapping helpers
    inputAssetsByFilename,
    getInputName,

    // Model assets - accessors
    getAssets,
    isModelLoading,
    getError,
    hasMore,
    hasAssetKey,

    // Model assets - actions
    updateModelsForNodeType,
    updateModelsForTag,
    updateAssetMetadata,
    updateAssetTags
  }
})
