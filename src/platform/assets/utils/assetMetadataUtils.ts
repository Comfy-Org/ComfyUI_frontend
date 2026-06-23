import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { isCloud } from '@/platform/distribution/types'
import { isCivitaiUrl } from '@/utils/formatUtil'

// Reserved tag literals (mirror assetService's MODELS_TAG/MISSING_TAG). Kept
// local so this leaf util doesn't pull the heavier assetService -> i18n chain.
const MODELS_TAG = 'models'
const MISSING_TAG = 'missing'

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
  const baseModel =
    asset.user_metadata?.base_model ?? asset.metadata?.base_model
  if (Array.isArray(baseModel)) {
    return baseModel.filter((m): m is string => typeof m === 'string')
  }
  if (typeof baseModel === 'string' && baseModel) {
    return [baseModel]
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
 * Extracts trigger phrases from asset metadata
 * Checks user_metadata first, then metadata, then returns empty array
 * @param asset - The asset to extract trigger phrases from
 * @returns Array of trigger phrases
 */
export function getAssetTriggerPhrases(asset: AssetItem): string[] {
  const phrases =
    asset.user_metadata?.trained_words ?? asset.metadata?.trained_words
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

const MODEL_TYPE_TAG_PREFIX = 'model_type:'

/** Strips the `model_type:` prefix off each namespaced tag, dropping non-`model_type:` tags. */
function getModelTypeTagValues(asset: AssetItem): string[] {
  return asset.tags
    .filter((tag) => tag.startsWith(MODEL_TYPE_TAG_PREFIX))
    .map((tag) => tag.slice(MODEL_TYPE_TAG_PREFIX.length))
    .filter((tag) => tag.length > 0)
}

/** Legacy grouping: each non-`models` tag's top-level path segment. */
function getBareTagCategories(asset: AssetItem): string[] {
  return asset.tags
    .filter((tag) => tag !== MODELS_TAG && tag.length > 0)
    .map((tag) => tag.split('/')[0])
}

/**
 * Resolves the category keys a model asset is grouped under.
 *
 * `modelTypeMode` reflects whether the backend declares the `model_type:` tag
 * scheme (the `supports_model_type_tags` capability). When true, an asset's
 * `model_type:*` values are authoritative; an asset with no `model_type:` tag
 * still routes by its bare tags. When false (the default) categories come from
 * the legacy bare-tag top-level grouping and `model_type:` is ignored.
 */
export function getAssetCategories(
  asset: AssetItem,
  modelTypeMode = false
): string[] {
  if (modelTypeMode) {
    const modelTypes = getModelTypeTagValues(asset)
    if (modelTypes.length > 0) return modelTypes
  }

  return getBareTagCategories(asset)
}

/** Number of `parent/child` segments in a tag, used to pick the most specific. */
function pathDepth(tag: string): number {
  return tag.split('/').length
}

/** Removes the `model_type:` namespace prefix from a tag when present. */
export function stripModelTypePrefix(tag: string): string {
  return tag.startsWith(MODEL_TYPE_TAG_PREFIX)
    ? tag.slice(MODEL_TYPE_TAG_PREFIX.length)
    : tag
}

/**
 * Resolves the short label shown on an asset card's type badge.
 *
 * Uses the first non-`models` tag (unchanged selection); in `modelTypeMode` a
 * `model_type:` namespace prefix on that tag is stripped so the badge doesn't
 * leak the raw namespace. Bare hierarchical tags still show the segment after
 * the first `/`.
 */
export function getAssetTypeBadge(
  asset: AssetItem,
  modelTypeMode = false
): string | undefined {
  const typeTag = asset.tags.find((tag) => tag !== MODELS_TAG)
  if (!typeTag) return undefined
  if (modelTypeMode && typeTag.startsWith(MODEL_TYPE_TAG_PREFIX)) {
    return stripModelTypePrefix(typeTag)
  }
  return typeTag.includes('/')
    ? typeTag.slice(typeTag.indexOf('/') + 1)
    : typeTag
}

/**
 * Resolves the model-type key used to look up a node provider for an asset.
 *
 * Unlike {@link getAssetCategories}, this keeps the full (possibly
 * hierarchical) value so `modelToNodeStore`'s `parent/child` fallback still
 * works.
 *
 * In `modelTypeMode` (backend declares `supports_model_type_tags`), candidates
 * are the stripped `model_type:*` values plus any other non-reserved tags, and
 * the most specific (deepest `parent/child`) candidate wins so a flat
 * `model_type:LLM` never shadows a resolvable `LLM/Qwen-VL/...` tag. Otherwise
 * we use the legacy first-non-reserved tag verbatim.
 */
export function getAssetNodeCategory(
  asset: AssetItem,
  modelTypeMode = false
): string | undefined {
  if (!modelTypeMode) {
    return asset.tags.find((tag) => tag !== MODELS_TAG && tag !== MISSING_TAG)
  }

  const otherTags = asset.tags.filter(
    (tag) =>
      tag !== MODELS_TAG &&
      tag !== MISSING_TAG &&
      !tag.startsWith(MODEL_TYPE_TAG_PREFIX)
  )
  const candidates = [...getModelTypeTagValues(asset), ...otherTags]
  if (candidates.length === 0) return undefined

  return candidates.reduce((best, candidate) =>
    pathDepth(candidate) > pathDepth(best) ? candidate : best
  )
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
 * Resolves the filename that addresses an asset's *bytes* in storage — use
 * this to build the path a backend resolves to a real file (the
 * `createAnnotatedPath` input behind `/view` requests and widget values),
 * never to show the user. Cloud is content-addressed, so it returns the
 * content hash (`hash`); OSS is filesystem-backed, so it returns `name`.
 *
 * For a human-readable label use {@link getAssetDisplayFilename}; for a
 * serialized identifier (matching, validation) use {@link getAssetFilename}.
 *
 * TODO(BE-933/934): collapse to `asset.file_path ?? asset.name`.
 */
export function getAssetStoredFilename(asset: AssetItem): string {
  return isCloud && asset.hash ? asset.hash : asset.name
}

/**
 * Human-readable filename for UI labels.
 * Fallback: user_metadata.filename → metadata.filename → display_name → asset.name.
 * For serialized identifiers use {@link getAssetFilename}.
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
 * curated name is absent or equal to asset.name (hash-keyed asset case).
 */
export function getAssetCardTitle(asset: AssetItem): string {
  const curatedName = getStringProperty(asset, 'name')
  if (curatedName && curatedName !== asset.name) return curatedName
  return getAssetDisplayFilename(asset)
}

export interface ImageDimensions {
  width: number
  height: number
}

/**
 * Type guard: a pixel dimension is a finite positive integer. `metadata` is
 * typed as `Record<string, unknown>`, so `typeof === 'number'` alone admits
 * NaN, Infinity, 0, negatives, and fractional values.
 */
function isValidDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Returns the original image dimensions from `asset.metadata.{width,height}`
 * when both pass shape validation, otherwise `undefined`. Callers should fall
 * back to the locally-computed `<img>.naturalWidth/Height`, which is correct
 * on runtimes that serve the original file but reports preview size on
 * runtimes that serve a downscaled preview.
 */
export function getAssetMetadataDimensions(
  asset: AssetItem | undefined
): ImageDimensions | undefined {
  const w = asset?.metadata?.width
  const h = asset?.metadata?.height
  if (isValidDimension(w) && isValidDimension(h)) {
    return { width: w, height: h }
  }
  return undefined
}

/**
 * Resolves the image dimensions an asset card should display.
 *
 * Prefers the server-provided original dimensions from
 * {@link getAssetMetadataDimensions}. Only when those are absent does it fall
 * back to `renderedNaturalSize` — the natural size of the `<img>` the card
 * actually rendered — and only when that rendered image was the original file.
 *
 * A distinct `thumbnail_url` (one that differs from `preview_url`) means the
 * card rendered a downscaled preview, so `renderedNaturalSize` reflects the
 * preview's dimensions rather than the asset's. In that case this returns
 * `undefined` so the card shows no label rather than a wrong resolution.
 * On OSS, `thumbnail_url` and `preview_url` are the same URL (full-res),
 * so the guard correctly passes through `renderedNaturalSize`.
 */
export function resolveDisplayImageDimensions(
  asset: AssetItem | undefined,
  renderedNaturalSize: ImageDimensions | undefined
): ImageDimensions | undefined {
  const fromMetadata = getAssetMetadataDimensions(asset)
  if (fromMetadata) return fromMetadata
  if (asset?.thumbnail_url && asset.thumbnail_url !== asset.preview_url)
    return undefined
  return renderedNaturalSize
}

/**
 * Returns the filename component the cloud `/api/view` endpoint resolves
 * for this asset — `hash` when present (cloud assets are hash-keyed
 * in storage), otherwise `asset.name`. Use this when constructing widget
 * values or media URLs that must round-trip through the view endpoint.
 */
export function getAssetUrlFilename(asset: AssetItem): string {
  return asset.hash ?? asset.name
}
