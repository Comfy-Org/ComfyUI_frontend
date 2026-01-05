import { useAsyncState } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, shallowReactive, ref, watch } from 'vue'
import {
  mapInputFileToAssetItem,
  mapTaskOutputToAssetItem
} from '@/platform/assets/composables/media/assetMappers'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import type { TaskItem } from '@/schemas/apiSchema'
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
 * Convert history task items to asset items
 */
function mapHistoryToAssets(historyItems: TaskItem[]): AssetItem[] {
  const assetItems: AssetItem[] = []

  for (const item of historyItems) {
    // Type guard for HistoryTaskItem which has status and outputs
    if (item.taskType !== 'History') {
      continue
    }

    if (!item.outputs || !item.status || item.status?.status_str === 'error') {
      continue
    }

    const task = new TaskItemImpl(
      'History',
      item.prompt,
      item.status,
      item.outputs
    )

    if (!task.previewOutput) {
      continue
    }

    const assetItem = mapTaskOutputToAssetItem(task, task.previewOutput)

    const supportedOutputs = task.flatOutputs.filter((o) => o.supportsPreview)
    assetItem.user_metadata = {
      ...assetItem.user_metadata,
      outputCount: supportedOutputs.length,
      allOutputs: supportedOutputs
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

    // Convert TaskItems to AssetItems
    const newAssets = mapHistoryToAssets(history.History)

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
    hasMoreHistory.value = history.History.length === BATCH_SIZE

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

  /**
   * Model assets cached by node type (e.g., 'CheckpointLoaderSimple', 'LoraLoader')
   * Used by multiple loader nodes to avoid duplicate fetches
   * Cloud-only feature - empty Maps in desktop builds
   */
  const getModelState = () => {
    if (isCloud) {
      const modelAssetsByNodeType = shallowReactive(
        new Map<string, AssetItem[]>()
      )
      const modelLoadingByNodeType = shallowReactive(new Map<string, boolean>())
      const modelErrorByNodeType = shallowReactive(
        new Map<string, Error | null>()
      )

      const stateByNodeType = shallowReactive(
        new Map<string, ReturnType<typeof useAsyncState<AssetItem[]>>>()
      )

      /**
       * Fetch and cache model assets for a specific node type
       * Uses VueUse's useAsyncState for automatic loading/error tracking
       * @param nodeType The node type to fetch assets for (e.g., 'CheckpointLoaderSimple')
       * @returns Promise resolving to the fetched assets
       */
      async function updateModelsForNodeType(
        nodeType: string
      ): Promise<AssetItem[]> {
        if (!stateByNodeType.has(nodeType)) {
          stateByNodeType.set(
            nodeType,
            useAsyncState(
              () => assetService.getAssetsForNodeType(nodeType),
              [],
              {
                immediate: false,
                resetOnExecute: false,
                onError: (err) => {
                  console.error(
                    `Error fetching model assets for ${nodeType}:`,
                    err
                  )
                }
              }
            )
          )
        }

        const state = stateByNodeType.get(nodeType)!

        modelLoadingByNodeType.set(nodeType, true)
        modelErrorByNodeType.set(nodeType, null)

        try {
          await state.execute()
          const assets = state.state.value
          modelAssetsByNodeType.set(nodeType, assets)
          modelErrorByNodeType.set(
            nodeType,
            state.error.value instanceof Error ? state.error.value : null
          )
          return assets
        } finally {
          modelLoadingByNodeType.set(nodeType, state.isLoading.value)
        }
      }

      return {
        modelAssetsByNodeType,
        modelLoadingByNodeType,
        modelErrorByNodeType,
        updateModelsForNodeType
      }
    }

    return {
      modelAssetsByNodeType: shallowReactive(new Map<string, AssetItem[]>()),
      modelLoadingByNodeType: shallowReactive(new Map<string, boolean>()),
      modelErrorByNodeType: shallowReactive(new Map<string, Error | null>()),
      updateModelsForNodeType: async () => []
    }
  }

  const {
    modelAssetsByNodeType,
    modelLoadingByNodeType,
    modelErrorByNodeType,
    updateModelsForNodeType
  } = getModelState()

  // Watch for completed downloads and refresh model caches
  watch(
    () => assetDownloadStore.completedDownloads,
    async (completedDownloads) => {
      if (completedDownloads.length === 0) return

      const latestDownload = completedDownloads[completedDownloads.length - 1]
      const { modelType } = latestDownload

      const providers = modelToNodeStore.getAllNodeProviders(modelType)
      const results = await Promise.allSettled(
        providers.map((provider) =>
          updateModelsForNodeType(provider.nodeDef.name).then(
            () => provider.nodeDef.name
          )
        )
      )

      for (const result of results) {
        if (result.status === 'rejected') {
          console.error(
            `Failed to refresh model cache for provider: ${result.reason}`
          )
        }
      }
    },
    { deep: true }
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

    // Model assets
    modelAssetsByNodeType,
    modelLoadingByNodeType,
    modelErrorByNodeType,
    updateModelsForNodeType
  }
})
