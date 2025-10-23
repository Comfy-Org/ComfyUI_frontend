import { useAsyncState } from '@vueuse/core'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import { useQueueStore } from '@/stores/queueStore'

import {
  mapInputFileToAssetItem,
  mapTaskOutputToAssetItem
} from './assetMappers'

/**
 * Fetch input directory files from the internal API
 */
async function fetchInputFiles(directory: string): Promise<AssetItem[]> {
  const response = await fetch(api.internalURL(`/files/${directory}`), {
    headers: {
      'Comfy-User': api.user
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${directory} files`)
  }

  const filenames: string[] = await response.json()
  return filenames.map((name, index) =>
    mapInputFileToAssetItem(name, index, directory as 'input')
  )
}

/**
 * Fetch output files from the queue store
 */
function fetchOutputFiles(): AssetItem[] {
  const queueStore = useQueueStore()

  // Use tasks (already grouped by promptId) instead of flatTasks
  const assetItems: AssetItem[] = queueStore.tasks
    .filter((task) => task.previewOutput && task.displayStatus === 'Completed')
    .map((task) => {
      const output = task.previewOutput!
      const assetItem = mapTaskOutputToAssetItem(task, output)

      // Add output count and all outputs for folder view
      assetItem.user_metadata = {
        ...assetItem.user_metadata,
        outputCount: task.flatOutputs.filter((o) => o.supportsPreview).length,
        allOutputs: task.flatOutputs.filter((o) => o.supportsPreview)
      }

      return assetItem
    })

  // Sort by creation date (newest first)
  return assetItems.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

/**
 * Composable for fetching media assets from local environment
 * Creates an independent instance for each directory
 */
export function useInternalFilesApi(directory: 'input' | 'output') {
  const fetchAssets = async (): Promise<AssetItem[]> => {
    if (directory === 'input') {
      return fetchInputFiles(directory)
    } else {
      return fetchOutputFiles()
    }
  }

  const {
    state: media,
    isLoading: loading,
    error,
    execute: fetchMediaList
  } = useAsyncState(fetchAssets, [], {
    immediate: false,
    resetOnExecute: false,
    onError: (err) => {
      console.error(`Error fetching ${directory} assets:`, err)
    }
  })

  const refresh = () => fetchMediaList()

  return {
    media,
    loading,
    error,
    fetchMediaList,
    refresh
  }
}
