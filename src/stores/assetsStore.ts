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

  return assetItems
}

const PAGE_SIZE = 50

export const useAssetsStore = defineStore('assets', () => {
  let historyAbortController: AbortController | null = null

  // Input assets state (using useAsyncState for simplicity)
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

  const historyAssets = ref<AssetItem[]>([])
  const historyPageNumber = ref(0)
  const historyLoading = ref(false)
  const historyError = ref<Error | null>(null)
  const hasMoreHistory = ref(true)

  const historyAssetIds = ref(new Set<string>())

  const fetchHistoryPage = async (pageNumber: number, append = false) => {
    if (historyLoading.value || (!hasMoreHistory.value && append)) return

    // Cancel any ongoing request
    if (historyAbortController) {
      historyAbortController.abort()
    }

    historyAbortController = new AbortController()

    historyLoading.value = true
    historyError.value = null

    try {
      const offset = pageNumber * PAGE_SIZE
      const history = await api.getHistory(PAGE_SIZE, offset)
      const newItems = mapHistoryToAssets(history.History)

      if (newItems.length < PAGE_SIZE) {
        hasMoreHistory.value = false
      }

      if (append && historyAssets.value.length > 0) {
        const uniqueNewItems = newItems.filter(
          (a) => !historyAssetIds.value.has(a.id)
        )

        uniqueNewItems.forEach((a) => historyAssetIds.value.add(a.id))
        historyAssets.value = [...historyAssets.value, ...uniqueNewItems]
      } else {
        // Reset for first page
        historyAssets.value = newItems
        historyAssetIds.value.clear()
        newItems.forEach((a) => historyAssetIds.value.add(a.id))
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        historyError.value = err as Error
        console.error('Error fetching history assets:', err)
      }
    } finally {
      historyLoading.value = false
      historyAbortController = null
    }
  }

  // Reset and fetch first page
  const updateHistory = async () => {
    historyPageNumber.value = 0
    hasMoreHistory.value = true
    await fetchHistoryPage(0, false)
  }

  // Load more history (increment page and append)
  const loadMoreHistory = async () => {
    historyPageNumber.value++
    await fetchHistoryPage(historyPageNumber.value, true)
  }

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
    hasMoreHistory,
    historyPageNumber,
    loadMoreHistory
  }
})
