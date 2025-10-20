import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import type { TaskItemImpl } from '@/stores/queueStore'
import { truncateFilename } from '@/utils/formatUtil'

/**
 * Maps a TaskItemImpl output to an AssetItem format
 * @param taskItem The task item containing execution data
 * @param output The output from the task
 * @param useDisplayName Whether to truncate the filename for display
 * @returns AssetItem formatted object
 */
export function mapTaskOutputToAssetItem(
  taskItem: TaskItemImpl,
  output: any,
  useDisplayName: boolean = false
): AssetItem {
  const metadata: Record<string, any> = {
    promptId: taskItem.promptId,
    nodeId: output.nodeId,
    subfolder: output.subfolder
  }

  // Add execution time if available
  if (taskItem.executionTimeInSeconds) {
    metadata.executionTimeInSeconds = taskItem.executionTimeInSeconds
  }

  // Add format if available
  if (output.format) {
    metadata.format = output.format
  }

  // Add workflow if available
  if (taskItem.workflow) {
    metadata.workflow = taskItem.workflow
  }

  // Store original filename if using display name
  if (useDisplayName) {
    metadata.originalFilename = output.filename
  }

  return {
    id: `${taskItem.promptId}-${output.nodeId}-${output.filename}`,
    name: useDisplayName
      ? truncateFilename(output.filename, 20)
      : output.filename,
    size: 0, // Size not available from history API
    created_at: taskItem.executionStartTimestamp
      ? new Date(taskItem.executionStartTimestamp).toISOString()
      : new Date().toISOString(),
    tags: ['output'],
    preview_url: output.url,
    user_metadata: metadata
  }
}

/**
 * Maps input directory file to AssetItem format
 * @param filename The filename
 * @param index File index for unique ID
 * @param directory The directory type
 * @returns AssetItem formatted object
 */
export function mapInputFileToAssetItem(
  filename: string,
  index: number,
  directory: 'input' | 'output' = 'input'
): AssetItem {
  return {
    id: `${directory}-${index}-${filename}`,
    name: filename,
    size: 0,
    created_at: new Date().toISOString(),
    tags: [directory],
    preview_url: api.apiURL(
      `/view?filename=${encodeURIComponent(filename)}&type=${directory}`
    )
  }
}
