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
 * Gets the display name for an asset, falling back to filename
 * @param asset - The asset to get display name from
 * @returns The display name or filename
 */
export function getAssetDisplayName(asset: AssetItem): string {
  return typeof asset.user_metadata?.display_name === 'string'
    ? asset.user_metadata.display_name
    : asset.name
}

/**
 * Safely extracts source URL from asset metadata
 * @param asset - The asset to extract source URL from
 * @returns The source URL or null if not present
 */
export function getAssetSourceUrl(asset: AssetItem): string | null {
  return typeof asset.user_metadata?.source_url === 'string'
    ? asset.user_metadata.source_url
    : null
}

/**
 * Extracts trigger phrases from asset metadata
 * @param asset - The asset to extract trigger phrases from
 * @returns Array of trigger phrases
 */
export function getAssetTriggerPhrases(asset: AssetItem): string[] {
  const phrases = asset.user_metadata?.trigger_phrases
  if (Array.isArray(phrases)) {
    return phrases.filter((p): p is string => typeof p === 'string')
  }
  if (typeof phrases === 'string') return [phrases]
  return []
}

/**
 * Extracts additional tags from asset user_metadata
 * @param asset - The asset to extract tags from
 * @returns Array of user-defined tags
 */
export function getAssetTags(asset: AssetItem): string[] {
  const tags = asset.user_metadata?.tags
  if (Array.isArray(tags)) {
    return tags.filter((t): t is string => typeof t === 'string')
  }
  return []
}

/**
 * Determines the source name from a URL
 * @param url - The source URL
 * @returns Human-readable source name
 */
export function getSourceName(url: string): string {
  if (url.includes('civitai.com')) return 'Civitai'
  if (url.includes('huggingface.co')) return 'Hugging Face'
  return 'Source'
}
