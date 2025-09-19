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
