import { useAsyncState } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  mapInputFileToAssetItem,
  mapTaskOutputToAssetItem
} from '@/platform/assets/composables/media/assetMappers'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'

import { TaskItemImpl } from './queueStore'

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
  return await assetService.getAssetsByTag('input', false)
}

/**
 * Convert history task items to asset items
 */
function mapHistoryToAssets(historyItems: any[]): AssetItem[] {
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

const BATCH_SIZE = 200

export const useAssetsStore = defineStore('assets', () => {
  const historyOffset = ref(0)
  const hasMoreHistory = ref(true)
  const isLoadingMore = ref(false)
  const allHistoryItems = ref<AssetItem[]>([])

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
    }

    const history = await api.getHistory(BATCH_SIZE, {
      offset: historyOffset.value
    })
    const newAssets = mapHistoryToAssets(history.History)

    if (loadMore) {
      const existingIds = new Set(allHistoryItems.value.map((item) => item.id))
      const uniqueNewAssets = newAssets.filter(
        (item) => !existingIds.has(item.id)
      )
      allHistoryItems.value = [...allHistoryItems.value, ...uniqueNewAssets]
    } else {
      allHistoryItems.value = newAssets
    }

    hasMoreHistory.value = newAssets.length === BATCH_SIZE
    historyOffset.value += newAssets.length

    return allHistoryItems.value
  }

  const historyAssets = ref<AssetItem[]>([])
  const historyLoading = ref(false)
  const historyError = ref<unknown>(null)

  const updateHistory = async () => {
    historyLoading.value = true
    historyError.value = null
    try {
      const assets = await fetchHistoryAssets(false)
      historyAssets.value = assets
    } catch (err) {
      console.error('Error fetching history assets:', err)
      historyError.value = err
    } finally {
      historyLoading.value = false
    }
  }

  const loadMoreHistory = async () => {
    if (!hasMoreHistory.value || isLoadingMore.value) return

    isLoadingMore.value = true
    try {
      const updatedAssets = await fetchHistoryAssets(true)
      historyAssets.value = updatedAssets
    } catch (err) {
      console.error('Error loading more history:', err)
      historyError.value = err
    } finally {
      isLoadingMore.value = false
    }
  }

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
    loadMoreHistory
  }
})
