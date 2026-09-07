import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { AugmentedResultItem } from '@/stores/resultItem'

/**
 * Metadata for output assets from queue store
 * Extends Record<string, unknown> for compatibility with AssetItem schema
 */
export interface OutputAssetMetadata extends Record<string, unknown> {
  jobId: string
  nodeId?: string | number
  subfolder: string
  executionTimeInSeconds?: number
  format?: string
  workflow?: ComfyWorkflowJSON
  outputCount?: number
  allOutputs?: AugmentedResultItem[]
}

/**
 * Type guard to check if metadata is OutputAssetMetadata
 */
function isOutputAssetMetadata(
  metadata: Record<string, unknown> | undefined
): metadata is OutputAssetMetadata {
  return (
    !!metadata &&
    typeof metadata.jobId === 'string' &&
    typeof metadata.subfolder === 'string'
  )
}

/**
 * Safely extract output asset metadata
 */
export function getOutputAssetMetadata(
  userMetadata: Record<string, unknown> | undefined
): OutputAssetMetadata | null {
  if (isOutputAssetMetadata(userMetadata)) {
    return userMetadata
  }
  return null
}
