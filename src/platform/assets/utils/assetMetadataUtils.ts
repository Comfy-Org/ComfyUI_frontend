import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

/**
 * Type-safe utilities for extracting metadata from assets
 */

/**
 * Safely extracts string description from asset metadata
 * @param asset - The asset to extract description from
 * @returns The description string or null if not present/not a string
 */
export function getAssetDescription(asset: AssetItem): string | null {
  return typeof asset.user_metadata?.description === 'string'
    ? asset.user_metadata.description
    : null
}

/**
 * Safely extracts string base_model from asset metadata
 * @param asset - The asset to extract base_model from
 * @returns The base_model string or null if not present/not a string
 */
export function getAssetBaseModel(asset: AssetItem): string | null {
  return typeof asset.user_metadata?.base_model === 'string'
    ? asset.user_metadata.base_model
    : null
}

/**
 * Safely extracts the ComfyUI-relative filename from user_metadata.
 * @param {import('../schemas/assetSchema').AssetItem} asset - The asset item containing user_metadata
 * @returns {string | null} ComfyUI-relative path or null if not available
 */
export function getAssetFilename(asset: AssetItem): string | null {
  const filename = asset.user_metadata?.filename

  if (typeof filename !== 'string' || !filename.trim()) {
    return null
  }

  return filename.trim()
}

/**
 * Validates if a filename path is safe for ComfyUI widget usage.
 * @param {string} filename - The filename to validate
 * @returns {boolean} True if filename is safe for widget usage
 */
export function validateAssetFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') return false

  const trimmed = filename.trim()
  if (!trimmed) return false

  // Reject dangerous patterns but allow forward slashes for subdirectories
  // e.g., reject "../../../etc/passwd" but allow "checkpoints/model.safetensors"
  if (trimmed.includes('..') || /[<>:"|?*]/.test(trimmed)) {
    return false
  }

  return true
}
