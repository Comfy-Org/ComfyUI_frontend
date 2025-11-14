/**
 * Utilities for extracting workflows from different sources
 * Supports both job-based and asset-based workflow extraction
 */

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'

/**
 * Extract workflow from AssetItem (async - may need file fetch)
 * Tries metadata first (for output assets), then falls back to extracting from file
 * This supports both output assets (with embedded metadata) and input assets (PNG with workflow)
 *
 * @param asset The asset item to extract workflow from
 * @returns WorkflowSource with workflow and generated filename
 *
 * @example
 * const asset = { name: 'output.png', user_metadata: { workflow: {...} } }
 * const { workflow, filename } = await extractWorkflowFromAsset(asset)
 */
export async function extractWorkflowFromAsset(asset: AssetItem): Promise<{
  workflow: ComfyWorkflowJSON | null
  filename: string
}> {
  const baseFilename = asset.name.replace(/\.[^/.]+$/, '.json')

  // Strategy 1: Try metadata first (for output assets)
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (metadata?.workflow) {
    return {
      workflow: metadata.workflow as ComfyWorkflowJSON,
      filename: baseFilename
    }
  }

  // Strategy 2: Try extracting from file (for input assets with embedded workflow)
  // This supports PNG, WEBP, FLAC, and other formats with metadata
  try {
    const fileUrl = getAssetUrl(asset)
    const response = await fetch(fileUrl)
    if (!response.ok) {
      return { workflow: null, filename: baseFilename }
    }

    const blob = await response.blob()
    const file = new File([blob], asset.name, { type: blob.type })

    const workflowData = await getWorkflowDataFromFile(file)
    if (workflowData?.workflow) {
      // Handle both string and object workflow data
      const workflow =
        typeof workflowData.workflow === 'string'
          ? JSON.parse(workflowData.workflow)
          : workflowData.workflow

      return {
        workflow: workflow as ComfyWorkflowJSON,
        filename: baseFilename
      }
    }
  } catch (error) {
    console.error('Failed to extract workflow from asset:', error)
  }

  return {
    workflow: null,
    filename: baseFilename
  }
}

/**
 * Check if a file format supports embedded workflow metadata
 * Useful for UI to show/hide workflow-related options
 *
 * @param filename The filename to check
 * @returns true if the format can contain workflow metadata
 *
 * @example
 * supportsWorkflowMetadata('image.png') // true
 * supportsWorkflowMetadata('image.jpg') // false
 */
export function supportsWorkflowMetadata(filename: string): boolean {
  const lower = filename.toLowerCase()
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.flac') ||
    lower.endsWith('.json')
  )
}
