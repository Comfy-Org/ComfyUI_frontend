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
export function isOutputAssetMetadata(
  metadata: any
): metadata is OutputAssetMetadata {
  return (
    metadata &&
    typeof metadata === 'object' &&
    typeof metadata.promptId === 'string' &&
    typeof metadata.nodeId === 'string'
  )
}

/**
 * Safely extract output asset metadata
 */
export function getOutputAssetMetadata(
  userMetadata: any
): OutputAssetMetadata | null {
  if (isOutputAssetMetadata(userMetadata)) {
    return userMetadata
  }
  return null
}
