import {
  inferBaseModelFromText,
  refineBaseModelLabels
} from '@/components/sidebar/tabs/cloudModelLibrary/baseModelInference'
import { getBaseModelOverrides } from '@/components/sidebar/tabs/cloudModelLibrary/baseModelOverrides'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { isCivitaiUrl } from '@/utils/formatUtil'

/**
 * Type-safe utilities for extracting metadata from assets.
 * These utilities check user_metadata first, then metadata, then fallback.
 */

/**
 * Helper to get a string property from user_metadata or metadata
 */
function getStringProperty(asset: AssetItem, key: string): string | undefined {
  const userValue = asset.user_metadata?.[key]
  if (typeof userValue === 'string') return userValue

  const metaValue = asset.metadata?.[key]
  if (typeof metaValue === 'string') return metaValue

  return undefined
}

/**
 * Safely extracts string description from asset metadata
 * Checks user_metadata first, then metadata, then returns null
 * @param asset - The asset to extract description from
 * @returns The description string or null if not present/not a string
 */
export function getAssetDescription(asset: AssetItem): string | null {
  return getStringProperty(asset, 'description') ?? null
}

/**
 * Safely extracts string base_model from asset metadata
 * Checks user_metadata first, then metadata, then returns null
 * @param asset - The asset to extract base_model from
 * @returns The base_model string or null if not present/not a string
 */
export function getAssetBaseModel(asset: AssetItem): string | null {
  return getStringProperty(asset, 'base_model') ?? null
}

/**
 * Extracts base models as an array from asset metadata
 * Checks user_metadata first, then metadata, then returns empty array
 * @param asset - The asset to extract base models from
 * @returns Array of base model strings
 */
export function getAssetBaseModels(asset: AssetItem): string[] {
  const filenameSources = [
    asset.name,
    typeof asset.metadata?.filename === 'string'
      ? asset.metadata.filename
      : undefined,
    typeof asset.metadata?.filepath === 'string'
      ? asset.metadata.filepath
      : undefined
  ].filter((s): s is string => Boolean(s))

  const baseModel =
    asset.user_metadata?.base_model ?? asset.metadata?.base_model
  let labels: string[] = []
  if (Array.isArray(baseModel)) {
    labels = baseModel.filter((m): m is string => typeof m === 'string')
  } else if (typeof baseModel === 'string' && baseModel) {
    labels = [baseModel]
  } else {
    const repoId = asset.metadata?.repo_id
    if (typeof repoId === 'string' && repoId) {
      labels = [...getBaseModelOverrides(repoId)]
    }
  }

  // base_model can name the family root (e.g. `Lightricks/LTX-Video`) while the
  // filename names a specific variant (`LTX_2.3_…`); let inference refine it.
  if (labels.length > 0) return refineBaseModelLabels(labels, filenameSources)

  // Civitai LoRAs etc. carry no repo_id or base_model — infer from filename.
  for (const source of filenameSources) {
    const inferred = inferBaseModelFromText(source)
    if (inferred) return [inferred]
  }
  return []
}

/**
 * Gets the display name for an asset
 * Checks user_metadata.name, then metadata.name, then display_name, then asset.name
 * @param asset - The asset to get display name from
 * @returns The display name
 */
export function getAssetDisplayName(asset: AssetItem): string {
  return getStringProperty(asset, 'name') || asset.display_name || asset.name
}

/**
 * Constructs source URL from asset's source_arn
 * @param asset - The asset to extract source URL from
 * @returns The source URL or null if not present/parseable
 */
export function getAssetSourceUrl(asset: AssetItem): string | null {
  if (typeof asset.metadata?.repo_url === 'string') {
    return asset.metadata.repo_url
  }
  // Note: Reversed priority for backwards compatibility
  const sourceArn =
    asset.metadata?.source_arn ?? asset.user_metadata?.source_arn
  if (typeof sourceArn !== 'string') return null

  const civitaiMatch = sourceArn.match(
    /^civitai:model:(\d+):version:(\d+)(?::file:\d+)?$/
  )
  if (civitaiMatch) {
    const [, modelId, versionId] = civitaiMatch
    return `https://civitai.com/models/${modelId}?modelVersionId=${versionId}`
  }

  return null
}

/**
 * Extracts trigger phrases from asset metadata.
 *
 * Cloud assets expose Civitai-style `trained_words` (an array). Local assets
 * read from safetensors expose a single `trigger_phrase` string (from the
 * `modelspec.trigger_phrase` header), so fall back to that when no
 * `trained_words` are present.
 *
 * Values are comma-delimited in the source data, often with trailing-comma
 * artifacts (e.g. `"freckles,"`). Splitting on commas and trimming yields
 * clean phrases for both display and copy-to-clipboard.
 *
 * Checks user_metadata first, then metadata.
 * @param asset - The asset to extract trigger phrases from
 * @returns Array of trigger phrases
 */
export function getAssetTriggerPhrases(asset: AssetItem): string[] {
  const phrases =
    asset.user_metadata?.trained_words ?? asset.metadata?.trained_words
  const raw = Array.isArray(phrases)
    ? phrases.filter((p): p is string => typeof p === 'string')
    : typeof phrases === 'string' && phrases
      ? [phrases]
      : []
  if (raw.length === 0) {
    const single =
      asset.user_metadata?.trigger_phrase ?? asset.metadata?.trigger_phrase
    if (typeof single === 'string') raw.push(single)
  }
  return raw
    .flatMap((entry) => entry.split(','))
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0)
}

/**
 * Extracts additional tags from asset user_metadata
 * @param asset - The asset to extract tags from
 * @returns Array of user-defined tags
 */
export function getAssetAdditionalTags(asset: AssetItem): string[] {
  const tags = asset.user_metadata?.additional_tags
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
  if (isCivitaiUrl(url)) return 'Civitai'
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname === 'huggingface.co' || hostname.endsWith('.huggingface.co')) {
      return 'Hugging Face'
    }
  } catch {
    // fall through for invalid URLs
  }
  return 'Source'
}

/**
 * Extracts the model type from asset tags
 * @param asset - The asset to extract model type from
 * @returns The model type string or null if not present
 */
export function getAssetModelType(asset: AssetItem): string | null {
  const typeTag = asset.tags?.find((tag) => tag && tag !== 'models')
  return typeTag ?? null
}

/**
 * Extracts user description from asset user_metadata
 * @param asset - The asset to extract user description from
 * @returns The user description string or empty string if not present
 */
export function getAssetUserDescription(asset: AssetItem): string {
  return typeof asset.user_metadata?.user_description === 'string'
    ? asset.user_metadata.user_description
    : ''
}

/**
 * Gets the filename for an asset with fallback chain
 * Checks user_metadata.filename first, then metadata.filename, then asset.name.
 * Use this for serialized/identifier contexts (workflow widget values,
 * filename schema validation, missing-model matching) where we need the
 * canonical filename and MUST NOT substitute a display-only string.
 */
export function getAssetFilename(asset: AssetItem): string {
  return getStringProperty(asset, 'filename') ?? asset.name
}

/**
 * Gets the human-readable filename to render in UI surfaces.
 * Fallback chain: user_metadata.filename → metadata.filename →
 * asset.display_name → asset.name.
 *
 * `display_name` is populated by queue output mappers in Cloud where
 * `asset.name` is a content hash. Use this helper for labels/titles only;
 * for serialized identifiers use {@link getAssetFilename}.
 */
export function getAssetDisplayFilename(asset: AssetItem): string {
  return (
    getStringProperty(asset, 'filename') ?? asset.display_name ?? asset.name
  )
}

/**
 * Gets the title to render on an asset browser card / delete confirmation.
 * Prefers a user-curated name (user_metadata.name / metadata.name) when it
 * actually differs from asset.name, so a user-renamed model keeps its
 * display name. Falls through to {@link getAssetDisplayFilename} when the
 * curated name is absent or equal to asset.name (Cloud hash case).
 */
export function getAssetCardTitle(asset: AssetItem): string {
  const curatedName = getStringProperty(asset, 'name')
  if (curatedName && curatedName !== asset.name) return curatedName
  return getAssetDisplayFilename(asset)
}

/**
 * Returns the filename component the cloud `/api/view` endpoint resolves
 * for this asset — `asset_hash` when present (cloud assets are hash-keyed
 * in storage), otherwise `asset.name`. Use this when constructing widget
 * values or media URLs that must round-trip through the view endpoint.
 */
export function getAssetUrlFilename(asset: AssetItem): string {
  return asset.hash ?? asset.asset_hash ?? asset.name
}
