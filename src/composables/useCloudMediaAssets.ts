import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import type { HistoryTaskItem } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { TaskItemImpl } from '@/stores/queueStore'

/**
 * Composable for fetching media assets from cloud environment
 * Includes execution time from history API
 */
export function useCloudMediaAssets() {
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
        return assets
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
          // Get execution time
          const executionTimeInSeconds = taskItem.executionTimeInSeconds

          // Process each output
          taskItem.flatOutputs.forEach((output) => {
            // Only include output type files (not temp previews)
            if (output.type === 'output' && output.supportsPreview) {
              // Truncate filename if longer than 15 characters
              let displayName = output.filename
              if (output.filename.length > 20) {
                // Get file extension
                const lastDotIndex = output.filename.lastIndexOf('.')
                const nameWithoutExt =
                  lastDotIndex > -1
                    ? output.filename.substring(0, lastDotIndex)
                    : output.filename
                const extension =
                  lastDotIndex > -1
                    ? output.filename.substring(lastDotIndex)
                    : ''

                // If name without extension is still long, truncate it
                if (nameWithoutExt.length > 10) {
                  displayName =
                    nameWithoutExt.substring(0, 10) +
                    '...' +
                    nameWithoutExt.substring(nameWithoutExt.length - 10) +
                    extension
                }
              }

              assetItems.push({
                id: `${taskItem.promptId}-${output.nodeId}-${output.filename}`,
                name: displayName,
                size: 0, // We don't have size info from history
                created_at: taskItem.executionStartTimestamp
                  ? new Date(taskItem.executionStartTimestamp).toISOString()
                  : new Date().toISOString(),
                tags: ['output'],
                preview_url: output.url,
                user_metadata: {
                  originalFilename: output.filename, // Store original filename
                  promptId: taskItem.promptId,
                  nodeId: output.nodeId,
                  subfolder: output.subfolder,
                  ...(executionTimeInSeconds && {
                    executionTimeInSeconds
                  }),
                  ...(output.format && {
                    format: output.format
                  }),
                  ...(taskItem.workflow && {
                    workflow: taskItem.workflow
                  })
                }
              })
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
