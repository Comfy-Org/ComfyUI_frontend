import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ResultItemImpl } from '@/stores/queueStore'

/**
 * Metadata for output assets. Originates from the queue/history mapping but
 * also surfaces on assets sourced directly from `/api/assets?include_tags=output`,
 * which carry `jobId` only (no per-output `nodeId` / `subfolder`).
 */
export interface OutputAssetMetadata extends Record<string, unknown> {
  jobId: string
  nodeId?: string | number
  subfolder?: string
  executionTimeInSeconds?: number
  format?: string
  workflow?: ComfyWorkflowJSON
  outputCount?: number
  allOutputs?: ResultItemImpl[]
}

function isOutputAssetMetadata(
  metadata: Record<string, unknown> | undefined
): metadata is OutputAssetMetadata {
  if (!metadata) return false
  return typeof metadata.jobId === 'string'
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
