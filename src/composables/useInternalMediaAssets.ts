import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { HistoryTaskItem } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { TaskItemImpl } from '@/stores/queueStore'

/**
 * Composable for fetching media assets from local environment
 * Uses the same logic as QueueSidebarTab for history processing
 */
export function useInternalMediaAssets() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch list of files from input or output directory with execution time
   * @param directory - 'input' or 'output'
   * @returns Array of AssetItem with execution time in user_metadata
   */
  const fetchMediaList = async (
    directory: 'input' | 'output'
  ): Promise<AssetItem[]> => {
    loading.value = true
    error.value = null

    try {
      // For input directory, fetch files without history
      if (directory === 'input') {
        const response = await fetch(api.internalURL(`/files/${directory}`), {
          headers: {
            'Comfy-User': api.user
          }
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch ${directory} files`)
        }
        const filenames: string[] = await response.json()

        return filenames.map((name, index) => ({
          id: `${directory}-${index}-${name}`,
          name,
          size: 0,
          created_at: new Date().toISOString(),
          tags: [directory],
          preview_url: api.apiURL(
            `/view?filename=${encodeURIComponent(name)}&type=${directory}`
          )
        }))
      }

      // For output directory, use history data like QueueSidebarTab
      const historyResponse = await api.getHistory(200)

      if (!historyResponse?.History) {
        return []
      }

      const assetItems: AssetItem[] = []

      // Process history items using TaskItemImpl like QueueSidebarTab
      historyResponse.History.forEach((historyItem: HistoryTaskItem) => {
        // Create TaskItemImpl to use the same logic as QueueSidebarTab
        const taskItem = new TaskItemImpl(
          'History',
          historyItem.prompt,
          historyItem.status,
          historyItem.outputs
        )

        // Only process completed tasks
        if (taskItem.displayStatus === 'Completed' && taskItem.outputs) {
          const executionTimeInSeconds = taskItem.executionTimeInSeconds
          const executionStartTimestamp = taskItem.executionStartTimestamp

          // Process each output using flatOutputs like QueueSidebarTab
          taskItem.flatOutputs.forEach((output) => {
            // Only include output type files (not temp previews)
            if (output.type === 'output' && output.supportsPreview) {
              assetItems.push({
                id: `${taskItem.promptId}-${output.nodeId}-${output.filename}`,
                name: output.filename,
                size: 0,
                created_at: executionStartTimestamp
                  ? new Date(executionStartTimestamp).toISOString()
                  : new Date().toISOString(),
                tags: ['output'],
                preview_url: output.url,
                user_metadata: {
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

      // Sort by creation date (newest first)
      return assetItems.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Error fetching ${directory} assets:`, errorMessage)
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
