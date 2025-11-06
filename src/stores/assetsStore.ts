import { useAsyncState } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, shallowReactive } from 'vue'

import {
  mapInputFileToAssetItem,
  mapTaskOutputToAssetItem
} from '@/platform/assets/composables/media/assetMappers'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import type { HistoryTaskItem } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

import { TaskItemImpl } from './queueStore'

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
function mapHistoryToAssets(historyItems: HistoryTaskItem[]): AssetItem[] {
  const assetItems: AssetItem[] = []

  for (const item of historyItems) {
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

export const useAssetsStore = defineStore('assets', () => {
  const maxHistoryItems = 200

  const getFetchInputFiles = () => {
    if (isCloud) {
      return fetchInputFilesFromCloud
    }
    return fetchInputFilesFromAPI
  }
  const fetchInputFiles = getFetchInputFiles()

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

  const fetchHistoryAssets = async (): Promise<AssetItem[]> => {
    const history = await api.getHistory(maxHistoryItems)
    return mapHistoryToAssets(history.History)
  }

  const {
    state: historyAssets,
    isLoading: historyLoading,
    error: historyError,
    execute: updateHistory
  } = useAsyncState(fetchHistoryAssets, [], {
    immediate: false,
    resetOnExecute: false,
    onError: (err) => {
      console.error('Error fetching history assets:', err)
    }
  })

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
    updateModelsForNodeType
  }
})
