import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import type { HistoryTaskItem } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { TaskItemImpl } from '@/stores/queueStore'
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
        const assets = await assetService.getAssetsByTag(directory)
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

      // For output directory, fetch history data and convert to AssetItem format
      const historyResponse = await api.getHistory(200)

      if (!historyResponse?.History) {
        return []
      }

      // Convert history items to AssetItem format
      const assetItems: AssetItem[] = []

      historyResponse.History.forEach((historyItem: HistoryTaskItem) => {
        // Create TaskItemImpl to use existing logic
        const taskItem = new TaskItemImpl(
          historyItem.taskType,
          historyItem.prompt,
          historyItem.status,
          historyItem.outputs
        )

        // Only process completed tasks
        if (taskItem.displayStatus === 'Completed' && taskItem.outputs) {
          // Process each output
          taskItem.flatOutputs.forEach((output) => {
            // Only include output type files (not temp previews)
            if (output.type === 'output' && output.supportsPreview) {
              const assetItem = mapTaskOutputToAssetItem(
                taskItem,
                output,
                true // Use display name for cloud
              )
              assetItems.push(assetItem)
            }
          })
        }
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
