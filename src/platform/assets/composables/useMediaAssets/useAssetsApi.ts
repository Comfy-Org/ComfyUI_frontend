import { useAsyncState } from '@vueuse/core'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { useQueueStore } from '@/stores/queueStore'

import { mapTaskOutputToAssetItem } from './assetMappers'

/**
 * Fetch input assets from cloud service
 */
async function fetchInputAssets(directory: string): Promise<AssetItem[]> {
  const assets = await assetService.getAssetsByTag(directory, false)
  return assets
}

/**
 * Fetch output assets from queue store
 */
function fetchOutputAssets(): AssetItem[] {
  const queueStore = useQueueStore()

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

  return assetItems
}

/**
 * Composable for fetching media assets from cloud environment
 * Creates an independent instance for each directory
 */
export function useAssetsApi(directory: 'input' | 'output') {
  const fetchAssets = async (): Promise<AssetItem[]> => {
    if (directory === 'input') {
      return fetchInputAssets(directory)
    } else {
      return fetchOutputAssets()
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
      console.error(`Error fetching ${directory} cloud assets:`, err)
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
