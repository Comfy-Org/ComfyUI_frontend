import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetContext } from '@/platform/assets/schemas/mediaAssetSchema'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { api } from '@/scripts/api'
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

/**
 * Strips ComfyUI's trailing directory-type annotation (e.g. ` [input]`,
 * ` [output]`, `[temp]`) from a filename returned by the OSS internal
 * `/internal/files/{type}` endpoint. The annotation is part of the wire
 * format LoadImage-style widgets expect, but for the assets sidebar we
 * want the canonical on-disk filename so type detection / titles work.
 */
function stripDirectoryAnnotation(filename: string): string {
  return filename.replace(/\s*\[(?:input|output|temp)\]\s*$/i, '')
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
  const cleanName = stripDirectoryAnnotation(filename)
  const params = new URLSearchParams({ filename: cleanName, type: directory })
  const preview_url = api.apiURL(`/view?${params}`)
  appendCloudResParam(params, cleanName)

  return {
    id: `${directory}-${index}-${cleanName}`,
    name: cleanName,
    size: 0,
    created_at: new Date().toISOString(),
    tags: [directory],
    thumbnail_url: api.apiURL(`/view?${params}`),
    preview_url
  }
}
