import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { ResultItemImpl } from '@/stores/queueStore'

type OutputAssetMapOptions = {
  promptId: string
  outputs: readonly ResultItemImpl[]
  createdAt?: string
  executionTimeInSeconds?: number
  workflow?: OutputAssetMetadata['workflow']
  excludeFilename?: string
}

export function shouldLoadFullOutputs(
  outputCount: OutputAssetMetadata['outputCount'],
  outputsLength: number
): boolean {
  return (
    typeof outputCount === 'number' &&
    outputCount > 1 &&
    outputsLength < outputCount
  )
}

export function mapOutputsToAssetItems({
  promptId,
  outputs,
  createdAt,
  executionTimeInSeconds,
  workflow,
  excludeFilename
}: OutputAssetMapOptions): AssetItem[] {
  const createdAtValue = createdAt ?? new Date().toISOString()

  return outputs
    .filter((output) => output.filename && output.filename !== excludeFilename)
    .map((output) => ({
      id: `${promptId}-${output.nodeId}-${output.filename}`,
      name: output.filename,
      size: 0,
      created_at: createdAtValue,
      tags: ['output'],
      preview_url: output.url,
      user_metadata: {
        promptId,
        nodeId: output.nodeId,
        subfolder: output.subfolder,
        executionTimeInSeconds,
        workflow
      }
    }))
}
