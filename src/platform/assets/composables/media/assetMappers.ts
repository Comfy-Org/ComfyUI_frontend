import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetContext } from '@/platform/assets/schemas/mediaAssetSchema'
import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'

/**
 * Extract asset type from tags array
 * @param tags The tags array from AssetItem
 * @returns The asset type ('input' or 'output')
 */
export function getAssetType(tags?: string[]): AssetContext['type'] {
  const tag = tags?.[0]
  if (tag === 'output') return 'output'
  return 'input'
}

/**
 * Maps a TaskItemImpl output to an AssetItem format
 * @param taskItem The task item containing execution data
 * @param output The output from the task
 * @param useDisplayName Whether to truncate the filename for display
 * @returns AssetItem formatted object
 */
export function mapTaskOutputToAssetItem(
  taskItem: TaskItemImpl,
  output: ResultItemImpl
): AssetItem {
  const metadata: OutputAssetMetadata = {
    jobId: taskItem.jobId,
    nodeId: output.nodeId,
    subfolder: output.subfolder,
    executionTimeInSeconds: taskItem.executionTimeInSeconds,
    format: output.format,
    create_time: taskItem.createTime
  }

  return {
    id: taskItem.jobId,
    name: output.filename,
    display_name: output.display_name,
    size: 0,
    created_at: taskItem.executionStartTimestamp
      ? new Date(taskItem.executionStartTimestamp).toISOString()
      : new Date().toISOString(),
    tags: ['output'],
    thumbnail_url: output.previewUrl,
    preview_url: output.url,
    user_metadata: metadata
  }
}
