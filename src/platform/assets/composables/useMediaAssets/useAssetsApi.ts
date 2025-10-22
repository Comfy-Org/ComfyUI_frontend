import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { useQueueStore } from '@/stores/queueStore'
import { truncateFilename } from '@/utils/formatUtil'

import { mapTaskOutputToAssetItem } from './assetMappers'

/**
 * Composable for fetching media assets from cloud environment
 * Includes execution time from history API
 */
export function useAssetsApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch list of assets from cloud with execution time
   * @param directory - 'input' or 'output'
   * @returns Array of AssetItem with execution time in user_metadata
   */
  const fetchMediaList = async (
    directory: 'input' | 'output'
  ): Promise<AssetItem[]> => {
    loading.value = true
    error.value = null

    try {
      // For input directory, just return assets without history
      if (directory === 'input') {
        const assets = await assetService.getAssetsByTag(directory, false)
        // Process assets to truncate long filenames for display
        return assets.map((asset) => ({
          ...asset,
          name: truncateFilename(asset.name, 20),
          user_metadata: {
            ...asset.user_metadata,
            originalFilename: asset.name.length > 20 ? asset.name : undefined
          }
        }))
      }

      // For output directory, use QueueStore's flatTasks
      const queueStore = useQueueStore()

      // Get all flat tasks that have preview outputs
      const assetItems: AssetItem[] = queueStore.flatTasks
        .filter(
          (task) => task.previewOutput && task.displayStatus === 'Completed'
        )
        .map((task) => {
          const output = task.previewOutput!
          return mapTaskOutputToAssetItem(
            task,
            output,
            true // Use display name for cloud
          )
        })

      return assetItems
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Error fetching ${directory} cloud assets:`, errorMessage)
      error.value = errorMessage
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    fetchMediaList
  }
}
