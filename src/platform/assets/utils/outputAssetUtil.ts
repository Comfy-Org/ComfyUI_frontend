import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { isCloud } from '@/platform/distribution/types'
import type { JobOutputAsset } from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'
import {
  getJobDetail,
  getPreviewableOutputsFromJobDetail
} from '@/services/jobOutputCache'
import type { ResultItemImpl } from '@/stores/queueStore'
import type { SerializedNodeId } from '@/types/nodeId'

type OutputAssetMapOptions = {
  jobId: string
  outputs: readonly ResultItemImpl[]
  createdAt?: string
  executionTimeInSeconds?: number
  workflow?: OutputAssetMetadata['workflow']
  excludeOutputKey?: string
}

type ResolveOutputAssetItemsOptions = {
  createdAt?: string
  excludeOutputKey?: string
}

type OutputKeyParts = {
  nodeId?: SerializedNodeId | null
  subfolder?: string | null
  filename?: string | null
}

function shouldLoadFullOutputs(
  outputCount: OutputAssetMetadata['outputCount'],
  outputsLength: number
): boolean {
  return (
    typeof outputCount === 'number' &&
    outputCount > 1 &&
    outputsLength < outputCount
  )
}

export function getAssetOutputCount(
  asset: Pick<AssetItem, 'user_metadata'>
): number {
  const count = asset.user_metadata?.outputCount
  return typeof count === 'number' && count > 0 ? count : 1
}

export function getTotalAssetOutputCount(
  assets: Pick<AssetItem, 'user_metadata'>[]
): number {
  return assets.reduce((sum, asset) => sum + getAssetOutputCount(asset), 0)
}

export function getOutputKey({
  nodeId,
  subfolder,
  filename
}: OutputKeyParts): string | null {
  if (nodeId == null || subfolder == null || !filename) {
    return null
  }

  return `${nodeId}-${subfolder}-${filename}`
}

/**
 * Maps a job's outputs to AssetItems with ids derived from the composite
 * `<nodeId>-<subfolder>-<filename>` key. Records sharing a composite key are
 * dropped after the first to keep `:key` unique in VirtualGrid — colliding
 * ids cause Vue to reuse one DOM node and visibly duplicate the asset on
 * scroll.
 *
 * The dedupe key ignores `type`/`mediaType`/`format`/`frame_rate` because
 * those fields don't appear in `AssetItem.id`, so widening the key would
 * just let the collision propagate. The kept copy is the first one seen;
 * callers that reverse the input (e.g. `resolveOutputAssetItems`) retain
 * the last record in the API's original order.
 */
function mapOutputsToAssetItems({
  jobId,
  outputs,
  createdAt,
  executionTimeInSeconds,
  workflow,
  excludeOutputKey
}: OutputAssetMapOptions): AssetItem[] {
  const createdAtValue = createdAt ?? new Date().toISOString()
  const seenOutputKeys = new Set<string>()

  return outputs.reduce<AssetItem[]>((items, output) => {
    const outputKey = getOutputKey(output)
    if (!output.filename || !outputKey || outputKey === excludeOutputKey) {
      return items
    }
    if (seenOutputKeys.has(outputKey)) {
      return items
    }
    seenOutputKeys.add(outputKey)

    items.push({
      id: `${jobId}-${outputKey}`,
      name: output.filename,
      display_name: output.display_name,
      size: 0,
      created_at: createdAtValue,
      tags: ['output'],
      thumbnail_url: output.previewUrl,
      preview_url: output.url,
      user_metadata: {
        jobId,
        nodeId: output.nodeId,
        subfolder: output.subfolder,
        executionTimeInSeconds,
        workflow
      }
    })

    return items
  }, [])
}

/**
 * Overlays a resolved job asset onto a synthesized output item, linking it to
 * the asset system: the placeholder `<jobId>-<outputKey>` id becomes the real
 * asset id, and hash/size/mime/preview plus per-output node context
 * (`nodeId`, `outputKey`, `outputIndex`) are filled from the endpoint.
 */
function overlayJobAsset(item: AssetItem, asset: JobOutputAsset): AssetItem {
  return {
    ...item,
    id: asset.id,
    hash: asset.hash ?? item.hash,
    size: asset.size ?? item.size,
    mime_type: asset.mime_type ?? item.mime_type,
    preview_url: asset.preview_url ?? item.preview_url,
    thumbnail_url: asset.preview_url ?? item.thumbnail_url,
    user_metadata: {
      ...item.user_metadata,
      nodeId: asset.node_id ?? item.user_metadata?.nodeId,
      outputKey: asset.output_key ?? item.user_metadata?.outputKey,
      outputIndex: asset.output_index ?? item.user_metadata?.outputIndex
    }
  }
}

/**
 * Resolves persisted job outputs to real asset entities via
 * GET /api/jobs/{job_id}/assets, matching by filename (the stable identifier
 * across the history and asset id spaces). Cloud-only; degrades to the
 * unresolved items when the endpoint returns nothing (e.g. not yet deployed).
 *
 * Each resolved asset is consumed at most once so that two outputs sharing a
 * filename (e.g. the same file under different subfolders) map to distinct
 * assets rather than colliding on one real id — a duplicate `AssetItem.id`
 * makes Vue reuse a DOM node and visibly duplicate the asset on scroll.
 */
async function enrichWithJobAssets(
  jobId: string,
  items: AssetItem[]
): Promise<AssetItem[]> {
  if (!items.length) return items

  const jobAssets = await api.getJobAssets(jobId)
  if (!jobAssets.length) return items

  const assetsByName = new Map<string, JobOutputAsset[]>()
  for (const asset of jobAssets) {
    const existing = assetsByName.get(asset.name)
    if (existing) {
      existing.push(asset)
    } else {
      assetsByName.set(asset.name, [asset])
    }
  }

  return items.map((item) => {
    const match = assetsByName.get(item.name)?.shift()
    return match ? overlayJobAsset(item, match) : item
  })
}

export async function resolveOutputAssetItems(
  metadata: OutputAssetMetadata,
  { createdAt, excludeOutputKey }: ResolveOutputAssetItemsOptions = {}
): Promise<AssetItem[]> {
  let outputsToDisplay = metadata.allOutputs ?? []
  if (shouldLoadFullOutputs(metadata.outputCount, outputsToDisplay.length)) {
    const jobDetail = await getJobDetail(metadata.jobId)
    const previewableOutputs = getPreviewableOutputsFromJobDetail(jobDetail)
    if (previewableOutputs.length) {
      outputsToDisplay = previewableOutputs
    }
  }

  // Reverse so the most recent outputs appear first
  const items = mapOutputsToAssetItems({
    jobId: metadata.jobId,
    outputs: outputsToDisplay.toReversed(),
    createdAt,
    executionTimeInSeconds: metadata.executionTimeInSeconds,
    workflow: metadata.workflow,
    excludeOutputKey
  })

  return isCloud ? enrichWithJobAssets(metadata.jobId, items) : items
}
