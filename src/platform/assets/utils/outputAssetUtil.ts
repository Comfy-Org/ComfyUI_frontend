import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { isCloud } from '@/platform/distribution/types'
import type { JobOutputAsset } from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'
import {
  getJobAssets,
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
 * asset id, and size/mime/preview are filled from the endpoint.
 *
 * `user_metadata` is left untouched. Its `nodeId` and `subfolder` come from
 * the same output entry and are read back as a pair — `useOutputStacks` rebuilds
 * `getOutputKey({ nodeId, subfolder, filename })` to exclude the output already
 * on screen — so overwriting only `nodeId` with the endpoint's (hash-correlated,
 * possibly disagreeing) `node_id` would describe an output that does not exist.
 * The endpoint's `node_id` is used to disambiguate matches instead, not to
 * relabel an item whose own `nodeId` is already required to be present.
 *
 * The endpoint's `hash` is deliberately not copied: downstream
 * `getAssetUrlFilename` treats `hash` as the storage filename, which the
 * endpoint's (`blake3:`-prefixed) value is not. The synthesized
 * `thumbnail_url` wins over the asset's `preview_url` because it carries the
 * resolution-capped `res=` variant; the asset value is the unbounded original.
 */
function overlayJobAsset(item: AssetItem, asset: JobOutputAsset): AssetItem {
  return {
    ...item,
    id: asset.id,
    size: asset.size ?? item.size,
    mime_type: asset.mime_type ?? item.mime_type,
    preview_url: asset.preview_url ?? item.preview_url,
    thumbnail_url: item.thumbnail_url ?? asset.preview_url ?? undefined
  }
}

/**
 * Composite `(filename, node id)` key. The node id is stringified because the
 * output side carries a `SerializedNodeId` (`string | number`) while the
 * endpoint always sends a string, and `9` must pair with `'9'`.
 */
function nodeScopedName(name: string, nodeId: unknown): string | null {
  return typeof nodeId === 'string' || typeof nodeId === 'number'
    ? JSON.stringify([name, String(nodeId)])
    : null
}

export async function findJobOutputAsset(
  metadata: OutputAssetMetadata,
  name: string
): Promise<JobOutputAsset | undefined> {
  const { assets, complete } = await api.getJobAssets(metadata.jobId)
  if (!complete) return undefined

  const nameMatches = assets.filter((asset) => asset.name === name)
  if (nameMatches.length === 1) return nameMatches[0]

  const nodeScopedMatches = nameMatches.filter(
    (asset) =>
      nodeScopedName(asset.name, asset.node_id) ===
      nodeScopedName(name, metadata.nodeId)
  )
  return nodeScopedMatches.length === 1 ? nodeScopedMatches[0] : undefined
}

/**
 * Indexes items and assets under a shared key and returns a lookup that pairs
 * them only when the key identifies exactly one of each. A null key (the field
 * it needs is absent) is never indexed, so it can never pair.
 */
function createUniquePairing(
  items: readonly AssetItem[],
  jobAssets: readonly JobOutputAsset[],
  keyOfItem: (item: AssetItem) => string | null,
  keyOfAsset: (asset: JobOutputAsset) => string | null
): (key: string | null) => JobOutputAsset | null {
  const assetsByKey = new Map<string, JobOutputAsset[]>()
  for (const asset of jobAssets) {
    const key = keyOfAsset(asset)
    if (key === null) continue
    const existing = assetsByKey.get(key)
    if (existing) {
      existing.push(asset)
    } else {
      assetsByKey.set(key, [asset])
    }
  }

  const itemCounts = new Map<string, number>()
  for (const item of items) {
    const key = keyOfItem(item)
    if (key === null) continue
    itemCounts.set(key, (itemCounts.get(key) ?? 0) + 1)
  }

  return (key) => {
    if (key === null) return null
    const candidates = assetsByKey.get(key)
    return candidates?.length === 1 && itemCounts.get(key) === 1
      ? candidates[0]
      : null
  }
}

/**
 * Resolves persisted job outputs to real asset entities via
 * GET /api/jobs/{job_id}/assets, matching by filename (the stable identifier
 * across the history and asset id spaces). Cloud-only; degrades to the
 * unresolved items when the endpoint returns nothing (e.g. not yet deployed).
 *
 * A filename duplicated on either side — among the outputs or among the
 * returned assets — falls back to `(filename, node_id)`, which separates the
 * common collision of one filename written by two different nodes. An output
 * still ambiguous under that pair, or whose asset carries no `node_id`, is
 * left unresolved: `zJobOutputAsset` carries no subfolder and the endpoint's
 * ordering is unspecified, so nothing else pairs duplicates reliably, and a
 * wrong pairing would render one file's preview under another's identity.
 */
async function enrichWithJobAssets(
  jobId: string,
  items: AssetItem[]
): Promise<AssetItem[]> {
  if (!items.length) return items

  let jobAssets: JobOutputAsset[]
  try {
    jobAssets = await getJobAssets(jobId)
  } catch (error) {
    console.error(`Failed to enrich job ${jobId} with assets:`, error)
    return items
  }
  if (!jobAssets.length) return items

  const matchByName = createUniquePairing(
    items,
    jobAssets,
    (item) => item.name,
    (asset) => asset.name
  )
  const matchByNodeScopedName = createUniquePairing(
    items,
    jobAssets,
    (item) => nodeScopedName(item.name, item.user_metadata?.nodeId),
    (asset) => nodeScopedName(asset.name, asset.node_id)
  )

  return items.map((item) => {
    const match =
      matchByName(item.name) ??
      matchByNodeScopedName(
        nodeScopedName(item.name, item.user_metadata?.nodeId)
      )
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
