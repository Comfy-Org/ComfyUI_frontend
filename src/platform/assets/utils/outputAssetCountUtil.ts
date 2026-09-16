import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetType } from '@/platform/assets/utils/assetTypeUtil'
import { getOutputKey } from '@/platform/assets/utils/outputKeyUtil'

type SelectedJobOutputs = {
  expectedCount: number
  outputKeys: Set<string>
}

export function getAssetOutputCount(
  asset: Pick<AssetItem, 'user_metadata'>
): number {
  const count = asset.user_metadata?.outputCount
  return typeof count === 'number' && count > 0 ? count : 1
}

/**
 * Counts the unique outputs a selection stands for.
 *
 * An expanded output stack puts a job-level parent and its children in the
 * same selection. The parent stands for every output of its job
 * (`outputCount`); each child stands for exactly one, and the child set never
 * includes the parent's own output. Summing them counts the job twice, so
 * outputs are grouped by job and each job contributes the larger of its
 * parent's `outputCount` and the number of distinct output identities
 * selected from it — the first covers a job-level selection whose children
 * were never expanded, the second a child-only selection.
 *
 * Assets that are not job outputs, and outputs whose metadata names no job,
 * count once each under their own id.
 */
export function getTotalAssetOutputCount(assets: readonly AssetItem[]): number {
  const individualCounts = new Map<string, number>()
  const outputsByJobId = new Map<string, SelectedJobOutputs>()

  for (const asset of assets) {
    const assetType = getAssetType(asset)
    const isJobOutput = assetType === 'output' || assetType === 'temp'
    const metadata = isJobOutput
      ? getOutputAssetMetadata(asset.user_metadata)
      : null

    if (!metadata) {
      individualCounts.set(
        asset.id,
        isJobOutput ? getAssetOutputCount(asset) : 1
      )
      continue
    }

    let selectedOutputs = outputsByJobId.get(metadata.jobId)
    if (!selectedOutputs) {
      selectedOutputs = { expectedCount: 0, outputKeys: new Set<string>() }
      outputsByJobId.set(metadata.jobId, selectedOutputs)
    }

    selectedOutputs.expectedCount = Math.max(
      selectedOutputs.expectedCount,
      getAssetOutputCount(asset)
    )
    selectedOutputs.outputKeys.add(
      getOutputKey({
        nodeId: metadata.nodeId,
        subfolder: metadata.subfolder,
        filename: asset.name
      }) ?? `asset:${asset.id}`
    )
  }

  let total = 0
  for (const count of individualCounts.values()) total += count
  for (const { expectedCount, outputKeys } of outputsByJobId.values()) {
    total += Math.max(expectedCount, outputKeys.size)
  }
  return total
}
