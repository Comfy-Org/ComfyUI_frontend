import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
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
  return mapOutputsToAssetItems({
    jobId: metadata.jobId,
    outputs: outputsToDisplay.toReversed(),
    createdAt,
    executionTimeInSeconds: metadata.executionTimeInSeconds,
    workflow: metadata.workflow,
    excludeOutputKey
  })
}
