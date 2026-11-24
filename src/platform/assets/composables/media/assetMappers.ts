import { groupBy } from 'es-toolkit'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getOutputSubfolder } from '@/platform/assets/utils/assetMetadataUtils'
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetContext } from '@/platform/assets/schemas/mediaAssetSchema'
import { getAssetType as getAssetSourceType } from '@/platform/assets/utils/assetTypeUtil'
import { getAssetViewUrl } from '@/platform/assets/utils/assetUrlUtil'
import { getStoredOutputIdentity } from '@/platform/assets/utils/outputAssetUtil'
import type { TaskItemImpl } from '@/stores/queueStore'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemPreviewUrl, resultItemUrl } from '@/utils/resultItemUrl'
import {
  getMediaTypeFromFilename,
  isPreviewableMediaType,
  parseFilePath
} from '@/utils/formatUtil'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'

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
  output: AugmentedResultItem
): AssetItem {
  const metadata: OutputAssetMetadata = {
    jobId: taskItem.jobId,
    nodeId: output.nodeId,
    subfolder: output.subfolder,
    executionTimeInSeconds: taskItem.executionTimeInSeconds,
    format: output.format,
    create_time: taskItem.createTime
  }

  const executionTime = taskItem.executionStartTimestamp
    ? new Date(taskItem.executionStartTimestamp).toISOString()
    : new Date().toISOString()

  return {
    id: taskItem.jobId,
    name: output.filename,
    display_name: output.display_name,
    size: 0,
    created_at: executionTime,
    updated_at: executionTime,
    tags: ['output'],
    thumbnail_url: resultItemPreviewUrl(output),
    preview_url: resultItemUrl(output),
    user_metadata: metadata
  }
}

const byCreatedAtAsc = (a: AssetItem, b: AssetItem): number =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
  a.name.localeCompare(b.name)

function isTempOutput(asset: AssetItem): boolean {
  return asset.tags.includes('temp') || getAssetSourceType(asset) === 'temp'
}

const NON_OUTPUT_TAGS = new Set(['input', 'models'])

/** Whether an asset added to a workflow lives in the temp root: its stored output identity, else temp evidence on a generated output. */
export function isGeneratedTempOutput(asset: AssetItem): boolean {
  const storedType = getStoredOutputIdentity(asset)?.type
  if (storedType) return storedType === 'temp'
  if (getAssetSourceType(asset) === 'input') return false
  return (
    !asset.tags.some((tag) => NON_OUTPUT_TAGS.has(tag)) && isTempOutput(asset)
  )
}

const byIsTemp = (a: AssetItem, b: AssetItem): number =>
  Number(isTempOutput(b)) - Number(isTempOutput(a))

function flatAssetToResultItem(asset: AssetItem): AugmentedResultItem {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  const url = asset.preview_url ?? ''
  return {
    assetId: asset.id,
    hash: asset.hash,
    display_name: asset.display_name ?? undefined,
    filename: asset.name,
    format: metadata?.format,
    mediaType: getMediaTypeFromFilename(asset.name),
    nodeId: metadata?.nodeId ?? '',
    subfolder: getOutputSubfolder(asset) ?? '',
    type: isTempOutput(asset) ? 'temp' : 'output',
    url,
    previewUrl: asset.thumbnail_url ?? url
  }
}

/**
 * Group flat per-file output assets into one asset per job, mirroring the
 * grouped shape produced from the history API: the group id is the job id and
 * user_metadata carries outputCount/allOutputs. Assets without output job
 * metadata pass through ungrouped. Each group takes the position of its first
 * asset, so the source order (e.g. the server's sort) is preserved.
 */
export function unflattenOutputAssets(
  flatAssets: readonly AssetItem[]
): AssetItem[] {
  const groups = groupBy(flatAssets, (asset) => asset.job_id || asset.id)
  return Object.entries(groups).map(([key, assets]) =>
    assets[0].job_id ? groupJobAssets(key, assets) : assets[0]
  )
}

function groupJobAssets(job_id: string, assets: AssetItem[]): AssetItem {
  const ordered = [...assets].sort(byCreatedAtAsc)
  const representative =
    [...ordered]
      .sort(byIsTemp)
      .findLast((asset) =>
        isPreviewableMediaType(getMediaTypeFromFilename(asset.name))
      ) ?? ordered.at(-1)!
  return {
    ...representative,
    id: job_id,
    created_at: ordered.at(-1)!.created_at,
    user_metadata: {
      jobId: job_id,
      ...representative.user_metadata,
      subfolder: getOutputSubfolder(representative) ?? '',
      assetId: representative.id,
      outputCount: ordered.length,
      allOutputs: ordered.map(flatAssetToResultItem)
    }
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
  const { filepath } = parseAnnotatedPath(filename)
  const { filename: name, subfolder } = parseFilePath(filepath)
  const created_at = new Date().toISOString()
  const asset = {
    id: `${directory}-${index}-${filepath}`,
    name,
    loader_path: subfolder ? `${subfolder}/${name}` : name,
    size: 0,
    created_at,
    updated_at: created_at,
    tags: [directory]
  }
  const preview_url = getAssetViewUrl(asset)
  return { ...asset, preview_url, thumbnail_url: preview_url }
}
