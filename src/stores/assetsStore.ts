import { useAsyncState } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, shallowReactive, ref } from 'vue'
import {
  mapInputFileToAssetItem,
  mapTaskOutputToAssetItem
} from '@/platform/assets/composables/media/assetMappers'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import { reconcileHistory } from '@/platform/remote/comfyui/history/reconciliation'
import type { TaskItem } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

import { TaskItemImpl } from './queueStore'

const INPUT_LIMIT = 100

/**
 * Extract promptId from asset ID
 */
const extractPromptId = (assetId: string): string => {
  return assetId.split('_')[0]
}

/**
 * Binary search to find insertion index in sorted array
 */
const findInsertionIndex = (array: AssetItem[], item: AssetItem): number => {
  let left = 0
  let right = array.length
  const itemTime = new Date(item.created_at).getTime()

  while (left < right) {
    const mid = Math.floor((left + right) / 2)
    const midTime = new Date(array[mid].created_at).getTime()

    // Sort by date descending (newest first)
    if (midTime < itemTime) {
      right = mid
    } else {
      left = mid + 1
    }
  }

  return left
}

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
  const historyOffset = ref(0)
  const hasMoreHistory = ref(true)
  const isLoadingMore = ref(false)
  const allHistoryItems = ref<AssetItem[]>([])

  // Map to track TaskItems for reconciliation
  const taskItemsMap = new Map<string, TaskItem>()
  // Map to track AssetItems by promptId for efficient reuse
  const assetItemsByPromptId = new Map<string, AssetItem>()

  // Keep track of last known queue index for V1 reconciliation
  let lastKnownQueueIndex: number | undefined = undefined

  // Promise-based guard to prevent race conditions
  let loadingPromise: Promise<void> | null = null

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

  const fetchHistoryAssets = async (loadMore = false): Promise<AssetItem[]> => {
    if (!loadMore) {
      historyOffset.value = 0
      hasMoreHistory.value = true
      allHistoryItems.value = []
      taskItemsMap.clear()
      assetItemsByPromptId.clear()
      lastKnownQueueIndex = undefined
    }

    const history = await api.getHistory(BATCH_SIZE, {
      offset: historyOffset.value
    })

    let itemsToProcess: TaskItem[]

    if (loadMore) {
      // For pagination: just add new items, don't use reconcileHistory
      // Since we're fetching with offset, these should be different items
      itemsToProcess = history.History

      // Add new items to taskItemsMap
      itemsToProcess.forEach((item) => {
        const promptId = item.prompt[1]
        // Only add if not already present (avoid duplicates)
        if (!taskItemsMap.has(promptId)) {
          taskItemsMap.set(promptId, item)
        }
      })
    } else {
      // Initial load - use reconcileHistory for deduplication
      itemsToProcess = reconcileHistory(
        history.History,
        [],
        MAX_HISTORY_ITEMS,
        lastKnownQueueIndex
      )

      // Clear and rebuild taskItemsMap
      taskItemsMap.clear()
      itemsToProcess.forEach((item) => {
        taskItemsMap.set(item.prompt[1], item)
      })
    }

    // Update last known queue index
    const allTaskItems = Array.from(taskItemsMap.values())
    if (allTaskItems.length > 0) {
      lastKnownQueueIndex = allTaskItems.reduce(
        (max, item) => Math.max(max, item.prompt[0]),
        -Infinity
      )
    }

    // Convert new items to AssetItems
    const newAssets = mapHistoryToAssets(itemsToProcess)

    if (loadMore) {
      // For pagination: insert new assets in sorted order
      newAssets.forEach((asset) => {
        const promptId = extractPromptId(asset.id)
        // Only add if not already present
        if (!assetItemsByPromptId.has(promptId)) {
          assetItemsByPromptId.set(promptId, asset)
          // Insert at correct position to maintain sort order
          const index = findInsertionIndex(allHistoryItems.value, asset)
          allHistoryItems.value.splice(index, 0, asset)
        }
      })
    } else {
      // Initial load: replace all
      assetItemsByPromptId.clear()
      allHistoryItems.value = []

      newAssets.forEach((asset) => {
        const promptId = extractPromptId(asset.id)
        assetItemsByPromptId.set(promptId, asset)
        allHistoryItems.value.push(asset)
      })
    }

    // Check if there are more items to load
    hasMoreHistory.value = history.History.length === BATCH_SIZE

    // Use fixed batch size for offset to avoid pagination gaps
    if (loadMore) {
      historyOffset.value += BATCH_SIZE
    } else {
      historyOffset.value = BATCH_SIZE
    }

    // Ensure we don't exceed MAX_HISTORY_ITEMS
    if (allHistoryItems.value.length > MAX_HISTORY_ITEMS) {
      allHistoryItems.value = allHistoryItems.value.slice(0, MAX_HISTORY_ITEMS)
    }

    return allHistoryItems.value
  }

  const historyAssets = ref<AssetItem[]>([])
  const historyLoading = ref(false)
  const historyError = ref<unknown>(null)

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

  const loadMoreHistory = async () => {
    // Check if we should load more
    if (!hasMoreHistory.value) return

    // Prevent race conditions with promise-based guard
    if (loadingPromise) return loadingPromise

    const doLoadMore = async () => {
      isLoadingMore.value = true
      historyError.value = null // Clear error before new attempt
      try {
        await fetchHistoryAssets(true)
        historyAssets.value = allHistoryItems.value
      } catch (err) {
        console.error('Error loading more history:', err)
        historyError.value = err
      } finally {
        isLoadingMore.value = false
      }
    }

    loadingPromise = doLoadMore()
    try {
      await loadingPromise
    } finally {
      loadingPromise = null
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
   * Get human-readable name for input asset filename
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

    // Input mapping helpers
    inputAssetsByFilename,
    getInputName,

    // Model assets
    modelAssetsByNodeType,
    modelLoadingByNodeType,
    modelErrorByNodeType,
    updateModelsForNodeType,
    loadMoreHistory
  }
})
