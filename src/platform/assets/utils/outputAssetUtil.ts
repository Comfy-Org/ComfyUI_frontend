import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getJobDetail,
  getPreviewableOutputsFromJobDetail
} from '@/services/jobOutputCache'
import type { ResultItemImpl } from '@/stores/queueStore'

type OutputAssetMapOptions = {
  promptId: string
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
  nodeId?: string | number | null
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

function mapOutputsToAssetItems({
  promptId,
  outputs,
  createdAt,
  executionTimeInSeconds,
  workflow,
  excludeOutputKey
}: OutputAssetMapOptions): AssetItem[] {
  const createdAtValue = createdAt ?? new Date().toISOString()

  return outputs.reduce<AssetItem[]>((items, output) => {
    const outputKey = getOutputKey(output)
    if (!output.filename || !outputKey || outputKey === excludeOutputKey) {
      return items
    }

    items.push({
      id: `${promptId}-${outputKey}`,
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
    const jobDetail = await getJobDetail(metadata.promptId)
    const previewableOutputs = getPreviewableOutputsFromJobDetail(jobDetail)
    if (previewableOutputs.length) {
      outputsToDisplay = previewableOutputs
    }
  }

  return mapOutputsToAssetItems({
    promptId: metadata.promptId,
    outputs: outputsToDisplay,
    createdAt,
    executionTimeInSeconds: metadata.executionTimeInSeconds,
    workflow: metadata.workflow,
    excludeOutputKey
  })
}
