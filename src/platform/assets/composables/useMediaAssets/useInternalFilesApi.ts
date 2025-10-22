import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import { useQueueStore } from '@/stores/queueStore'

import {
  mapInputFileToAssetItem,
  mapTaskOutputToAssetItem
} from './assetMappers'

/**
 * Composable for fetching media assets from local environment
 * Uses the same logic as QueueSidebarTab for history processing
 */
export function useInternalFilesApi() {
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

        return filenames.map((name, index) =>
          mapInputFileToAssetItem(name, index, directory)
        )
      }

      const queueStore = useQueueStore()

      // Use tasks (already grouped by promptId) instead of flatTasks
      const assetItems: AssetItem[] = queueStore.tasks
        .filter(
          (task) => task.previewOutput && task.displayStatus === 'Completed'
        )
        .map((task) => {
          const output = task.previewOutput!
          const assetItem = mapTaskOutputToAssetItem(
            task,
            output,
            false // Don't use display name for internal
          )

          // Add output count and all outputs for folder view
          assetItem.user_metadata = {
            ...assetItem.user_metadata,
            outputCount: task.flatOutputs.filter((o) => o.supportsPreview)
              .length,
            allOutputs: task.flatOutputs.filter((o) => o.supportsPreview)
          }

          return assetItem
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
