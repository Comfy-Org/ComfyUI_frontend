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
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
        const assetTime = new Date(asset.created_at).getTime()
        const insertIndex = allHistoryItems.value.findIndex(
          (item) => new Date(item.created_at).getTime() < assetTime
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

      function createInitialState(): ModelPaginationState {
        const state: ModelPaginationState = {
          assets: new Map(),
          offset: 0,
          hasMore: true,
          isLoading: false
        }
        return reactive(state)
      }

      function getOrCreateState(key: string): ModelPaginationState {
        if (!modelStateByKey.value.has(key)) {
          modelStateByKey.value.set(key, createInitialState())
        }
        return modelStateByKey.value.get(key)!
      }

      function resetPaginationForKey(key: string) {
        const state = getOrCreateState(key)
        state.assets = new Map()
        state.offset = 0
        state.hasMore = true
        delete state.error
      }

      function getAssets(key: string): AssetItem[] {
        return Array.from(modelStateByKey.value.get(key)?.assets.values() ?? [])
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

      /**
       * Internal helper to fetch and cache assets with a given key and fetcher.
       * Loads first batch immediately, then progressively loads remaining batches.
       */
      async function updateModelsForKey(
        key: string,
        fetcher: (options: PaginationOptions) => Promise<AssetItem[]>
      ): Promise<AssetItem[]> {
        const state = getOrCreateState(key)

        resetPaginationForKey(key)
        state.isLoading = true

        try {
          const assets = await fetcher({
            limit: MODEL_BATCH_SIZE,
            offset: 0
          })

          state.assets = new Map(assets.map((a) => [a.id, a]))
          state.offset = assets.length
          state.hasMore = assets.length === MODEL_BATCH_SIZE

          if (state.hasMore) {
            void loadRemainingBatches(key, fetcher)
          }

          return assets
        } catch (err) {
          state.error = err instanceof Error ? err : new Error(String(err))
          console.error(`Error fetching model assets for ${key}:`, err)
          return []
        } finally {
          state.isLoading = false
        }
      }

      /**
       * Progressively load remaining batches until complete
       */
      async function loadRemainingBatches(
        key: string,
        fetcher: (options: PaginationOptions) => Promise<AssetItem[]>
      ): Promise<void> {
        const state = modelStateByKey.value.get(key)
        if (!state) return

        while (state.hasMore) {
          try {
            const newAssets = await fetcher({
              limit: MODEL_BATCH_SIZE,
              offset: state.offset
            })

            for (const asset of newAssets) {
              if (!state.assets.has(asset.id)) {
                state.assets.set(asset.id, asset)
              }
            }

            state.offset += newAssets.length
            state.hasMore = newAssets.length === MODEL_BATCH_SIZE
          } catch (err) {
            console.error(`Error loading batch for ${key}:`, err)
            break
          }
        }
      }

      /**
       * Fetch and cache model assets for a specific node type
       * @param nodeType The node type to fetch assets for (e.g., 'CheckpointLoaderSimple')
       * @returns Promise resolving to the fetched assets
       */
      async function updateModelsForNodeType(
        nodeType: string
      ): Promise<AssetItem[]> {
        return updateModelsForKey(nodeType, (opts) =>
          assetService.getAssetsForNodeType(nodeType, opts)
        )
      }

      /**
       * Fetch and cache model assets for a specific tag
       * @param tag The tag to fetch assets for (e.g., 'models')
       * @returns Promise resolving to the fetched assets
       */
      async function updateModelsForTag(tag: string): Promise<AssetItem[]> {
        const key = `tag:${tag}`
        return updateModelsForKey(key, (opts) =>
          assetService.getAssetsByTag(tag, true, opts)
        )
      }

      return {
        getAssets,
        isLoading,
        getError,
        hasMore,
        updateModelsForNodeType,
        updateModelsForTag
      }
    }

    const emptyAssets: AssetItem[] = []
    return {
      getAssets: () => emptyAssets,
      isLoading: () => false,
      getError: () => undefined,
      hasMore: () => false,
      updateModelsForNodeType: async () => emptyAssets,
      updateModelsForTag: async () => emptyAssets
    }
  }

  const {
    getAssets,
    isLoading: isModelLoading,
    getError,
    hasMore,
    updateModelsForNodeType,
    updateModelsForTag
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

    // Model assets - actions
    updateModelsForNodeType,
    updateModelsForTag
  }
})
