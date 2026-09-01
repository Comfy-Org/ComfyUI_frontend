import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetContext } from '@/platform/assets/schemas/mediaAssetSchema'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { api } from '@/scripts/api'
import type { ResultItemInit, TaskItemImpl } from '@/stores/queueStore'
import { ResultItemImpl } from '@/stores/queueStore'
import {
  getMediaTypeFromFilename,
  isPreviewableMediaType
} from '@/utils/formatUtil'

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
    thumbnail_url: output.previewUrl,
    preview_url: output.url,
    user_metadata: metadata
  }
}

const byCreatedAtAsc = (a: AssetItem, b: AssetItem): number =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
  a.name.localeCompare(b.name)

const byCreatedAtDesc = (a: AssetItem, b: AssetItem): number =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
const byIsTemp = (a: AssetItem, b: AssetItem): number =>
  Number(b.tags.includes('temp')) - Number(a.tags.includes('temp'))

function flatAssetToResultItem(asset: AssetItem): ResultItemImpl {
  class AssetResultItem extends ResultItemImpl {
    private readonly _url: string
    private readonly _previewUrl: string

    constructor(asset: AssetItem, init: ResultItemInit) {
      super(init)
      this._url = asset.preview_url ?? ''
      this._previewUrl = asset.thumbnail_url ?? this._url
    }

    override get url(): string {
      return this._url
    }

    override get previewUrl(): string {
      return this._previewUrl
    }
  }

  const metadata = getOutputAssetMetadata(asset.user_metadata)
  return new AssetResultItem(asset, {
    assetId: asset.id,
    display_name: asset.display_name ?? undefined,
    filename: asset.name,
    format: metadata?.format,
    mediaType: getMediaTypeFromFilename(asset.name),
    nodeId: metadata?.nodeId ?? '',
    subfolder: metadata?.subfolder ?? '',
    type: 'output'
  })
}

/**
 * Group flat per-file output assets into one asset per job, mirroring the
 * grouped shape produced from the history API: the group id is the job id and
 * user_metadata carries outputCount/allOutputs. Assets without output job
 * metadata pass through ungrouped.
 */
export function unflattenOutputAssets(
  flatAssets: readonly AssetItem[]
): AssetItem[] {
  const assetsByJob = new Map<string, AssetItem[]>()
  const ungrouped: AssetItem[] = []

  for (const asset of flatAssets) {
    const { job_id } = asset
    if (!job_id) {
      ungrouped.push(asset)
      continue
    }
    const group = assetsByJob.get(job_id)
    if (group) group.push(asset)
    else assetsByJob.set(job_id, [asset])
  }

  const grouped = [...assetsByJob.entries()].map(([job_id, assets]) => {
    const ordered = [...assets].sort(byCreatedAtAsc)
    const representative =
      ordered
        .toSorted(byIsTemp)
        .findLast((asset) =>
          isPreviewableMediaType(getMediaTypeFromFilename(asset.name))
        ) ?? ordered.at(-1)!
    return {
      ...representative,
      id: job_id,
      created_at: ordered.at(-1)!.created_at,
      user_metadata: {
        jobId: job_id,
        subfolder: '',
        ...representative.user_metadata,
        outputCount: ordered.length,
        allOutputs: ordered.map(flatAssetToResultItem)
      }
    }
  })

  return [...grouped, ...ungrouped].sort(byCreatedAtDesc)
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

  const created_at = new Date().toISOString()
  return {
    id: `${directory}-${index}-${cleanName}`,
    name: cleanName,
    size: 0,
    created_at,
    updated_at: created_at,
    tags: [directory],
    thumbnail_url: api.apiURL(`/view?${params}`),
    preview_url
  }
}
