import type { ResultItemImpl } from '@/stores/queueStore'

/**
 * Metadata for output assets from queue store
 * Extends Record<string, unknown> for compatibility with AssetItem schema
 */
export interface OutputAssetMetadata extends Record<string, unknown> {
  promptId: string
  nodeId: string | number
  subfolder: string
  executionTimeInSeconds?: number
  format?: string
  workflow?: unknown
  outputCount?: number
  allOutputs?: ResultItemImpl[]
}

/**
 * Type guard to check if metadata is OutputAssetMetadata
 */
function isOutputAssetMetadata(
  metadata: Record<string, unknown> | undefined
): metadata is OutputAssetMetadata {
  if (!metadata) return false
  return (
    typeof metadata.promptId === 'string' &&
    (typeof metadata.nodeId === 'string' || typeof metadata.nodeId === 'number')
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
