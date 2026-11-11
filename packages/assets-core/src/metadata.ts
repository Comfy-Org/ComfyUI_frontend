import type { Size2D as ImageDimensions } from '@comfyorg/shared-frontend-utils/geometry'
import type { AssetItem, ModelBrowserAsset } from './schema'
import { isCivitaiUrl } from '@comfyorg/shared-frontend-utils/formatUtil'
export const MODELS_TAG = 'models'
export const MISSING_TAG = 'missing'
export const INPUT_TAG = 'input'
export const OUTPUT_TAG = 'output'
function getStringProperty(asset: AssetItem, key: string): string | undefined {
  const userValue = asset.user_metadata?.[key]
  if (typeof userValue === 'string') return userValue
  const metaValue = asset.metadata?.[key]
  if (typeof metaValue === 'string') return metaValue
  return undefined
}
export function getAssetDescription(asset: AssetItem): string | null {
  return getStringProperty(asset, 'description') ?? null
}
export function getAssetBaseModel(asset: AssetItem): string | null {
  return getStringProperty(asset, 'base_model') ?? null
}
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
export function getAssetDisplayName(asset: AssetItem): string {
  return getStringProperty(asset, 'name') || asset.display_name || asset.name
}
export function getAssetSourceUrl(asset: AssetItem): string | null {
  if (typeof asset.metadata?.repo_url === 'string') {
    return asset.metadata.repo_url
  }
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
export function getAssetTriggerPhrases(asset: AssetItem): string[] {
  const phrases =
    asset.user_metadata?.trained_words ?? asset.metadata?.trained_words
  if (Array.isArray(phrases)) {
    return phrases.filter((p): p is string => typeof p === 'string')
  }
  if (typeof phrases === 'string') return [phrases]
  return []
}
export function getAssetAdditionalTags(asset: AssetItem): string[] {
  const tags = asset.user_metadata?.additional_tags
  if (Array.isArray(tags)) {
    return tags.filter((t): t is string => typeof t === 'string')
  }
  return []
}
export function getSourceName(url: string): string {
  if (isCivitaiUrl(url)) return 'Civitai'
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname === 'huggingface.co' || hostname.endsWith('.huggingface.co')) {
      return 'Hugging Face'
    }
  } catch {
    return 'Source'
  }
  return 'Source'
}
export const MODEL_TYPE_TAG_PREFIX = 'model_type:'
export function getAssetModelType(asset: AssetItem): string | null {
  const typeTag = asset.tags.find(
    (tag) => tag && tag !== MODELS_TAG && !tag.startsWith(MODEL_TYPE_TAG_PREFIX)
  )
  return typeTag ?? null
}
export function toModelTypeTag(folderName: string): string {
  if (folderName.startsWith(MODEL_TYPE_TAG_PREFIX)) return folderName
  return `${MODEL_TYPE_TAG_PREFIX}${folderName}`
}
function getModelTypeTagValues(asset: AssetItem): string[] {
  return asset.tags
    .filter((tag) => tag.startsWith(MODEL_TYPE_TAG_PREFIX))
    .map((tag) => tag.slice(MODEL_TYPE_TAG_PREFIX.length))
    .filter((tag) => tag.length > 0)
}
export function isModelTypeCovered(asset: AssetItem): boolean {
  return getModelTypeTagValues(asset).length > 0
}
function getPrimaryModelType(asset: AssetItem): string | undefined {
  return [...getModelTypeTagValues(asset)].sort()[0]
}
export function getEditableModelType(
  asset: AssetItem,
  modelTypeMode: boolean
): string | null {
  if (modelTypeMode) {
    const primary = getPrimaryModelType(asset)
    if (primary !== undefined) return primary
  }
  return getAssetModelType(asset)
}
export function buildModelTypeTagUpdate(
  asset: AssetItem,
  newFolderName: string,
  modelTypeMode: boolean
): string[] {
  if (!modelTypeMode) {
    const currentType = getAssetModelType(asset)
    return asset.tags.filter((tag) => tag !== currentType).concat(newFolderName)
  }
  const primary = getPrimaryModelType(asset)
  const currentBareType = getAssetModelType(asset)
  const tagsToRemove =
    primary !== undefined
      ? new Set([toModelTypeTag(primary), primary])
      : new Set(currentBareType ? [currentBareType] : [])
  const newTag = toModelTypeTag(newFolderName)
  const retained = asset.tags.filter((tag) => !tagsToRemove.has(tag))
  return retained.includes(newTag) ? retained : retained.concat(newTag)
}
export function resolveModelTypeTagUpdate(
  asset: AssetItem,
  newFolderName: string,
  isEditable: boolean,
  modelTypeMode: boolean
): string[] | null {
  if (!isEditable) return null
  if (getEditableModelType(asset, modelTypeMode) === newFolderName) return null
  return buildModelTypeTagUpdate(asset, newFolderName, modelTypeMode)
}
function getBareTagCategories(asset: AssetItem): string[] {
  return asset.tags
    .filter((tag) => tag !== MODELS_TAG && tag.length > 0)
    .map((tag) => tag.split('/')[0])
}
export function getAssetCategories(
  asset: ModelBrowserAsset,
  modelTypeMode: boolean
): string[] {
  if (asset.browserCategories) return asset.browserCategories
  if (modelTypeMode) {
    const modelTypes = getModelTypeTagValues(asset)
    if (modelTypes.length > 0) return modelTypes
    return getBareTagCategories(asset).filter(
      (category) => !category.startsWith(MODEL_TYPE_TAG_PREFIX)
    )
  }
  return getBareTagCategories(asset)
}
export function getPrimaryCategoryTag(
  asset: AssetItem,
  modelTypeMode: boolean
): string | undefined {
  if (modelTypeMode) {
    const primary = getPrimaryModelType(asset)
    if (primary !== undefined) return primary
    return asset.tags.find(
      (tag) => tag !== MODELS_TAG && !tag.startsWith(MODEL_TYPE_TAG_PREFIX)
    )
  }
  return asset.tags.find((tag) => tag !== MODELS_TAG)
}
function pathDepth(tag: string): number {
  return tag.split('/').length
}
export function stripModelTypePrefix(tag: string): string {
  return tag.startsWith(MODEL_TYPE_TAG_PREFIX)
    ? tag.slice(MODEL_TYPE_TAG_PREFIX.length)
    : tag
}
export function getAssetTypeBadges(
  asset: ModelBrowserAsset,
  modelTypeMode: boolean
): string[] {
  if (asset.browserCategories) return asset.browserCategories
  if (modelTypeMode) {
    const modelTypes = getModelTypeTagValues(asset)
    if (modelTypes.length > 0) return modelTypes
  }
  const typeTag = asset.tags.find(
    (tag) =>
      tag !== MODELS_TAG &&
      !(modelTypeMode && tag.startsWith(MODEL_TYPE_TAG_PREFIX))
  )
  if (!typeTag) return []
  return [
    typeTag.includes('/') ? typeTag.slice(typeTag.indexOf('/') + 1) : typeTag
  ]
}
export function getAssetNodeCategoryCandidates(
  asset: ModelBrowserAsset,
  modelTypeMode: boolean
): string[] {
  if (asset.browserCategories) return asset.browserCategories
  if (!modelTypeMode) {
    const legacy = asset.tags.find(
      (tag) => tag !== MODELS_TAG && tag !== MISSING_TAG
    )
    return legacy ? [legacy] : []
  }
  const bareTags = asset.tags.filter(
    (tag) =>
      tag !== MODELS_TAG &&
      tag !== MISSING_TAG &&
      !tag.startsWith(MODEL_TYPE_TAG_PREFIX)
  )
  const byDepthDesc = (a: string, b: string) => pathDepth(b) - pathDepth(a)
  const modelTypes = getModelTypeTagValues(asset)
  if (modelTypes.length === 0) return [...bareTags].sort(byDepthDesc)
  const isRelated = (tag: string) =>
    modelTypes.some((type) => tag === type || tag.startsWith(`${type}/`))
  return [
    ...[...new Set([...modelTypes, ...bareTags.filter(isRelated)])].sort(
      byDepthDesc
    ),
    ...bareTags.filter((tag) => !isRelated(tag)).sort(byDepthDesc)
  ]
}
export function getAssetUserDescription(asset: AssetItem): string {
  return typeof asset.user_metadata?.user_description === 'string'
    ? asset.user_metadata.user_description
    : ''
}
export function getAssetFilename(asset: AssetItem): string {
  return getStringProperty(asset, 'filename') ?? asset.name
}
export function getAssetDisplayFilename(asset: AssetItem): string {
  return (
    getStringProperty(asset, 'filename') ?? asset.display_name ?? asset.name
  )
}
export function getAssetCardTitle(asset: AssetItem): string {
  const curatedName = getStringProperty(asset, 'name')
  if (curatedName && curatedName !== asset.name) return curatedName
  return getAssetDisplayFilename(asset)
}
export type { Size2D as ImageDimensions } from '@comfyorg/shared-frontend-utils/geometry'
function isValidDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}
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
export function getAssetUrlFilename(asset: AssetItem): string {
  return asset.hash ?? asset.name
}
export function getOutputSubfolder(
  asset: Pick<AssetItem, 'hash' | 'loader_path' | 'user_metadata'>
): string | undefined {
  const subfolder = asset.user_metadata?.subfolder
  if (typeof subfolder === 'string') return subfolder
  if (asset.hash || !asset.loader_path) return undefined
  const separatorIndex = asset.loader_path.lastIndexOf('/')
  return separatorIndex > 0
    ? asset.loader_path.slice(0, separatorIndex)
    : undefined
}

export function getAssetType(
  asset: AssetItem,
  defaultType: 'input' | 'output' = 'output'
): string {
  const urlType = new URLSearchParams(
    (asset.preview_url ?? '').split('?')[1] ?? ''
  ).get('type')
  return urlType || asset.tags[0] || defaultType
}

export function getAssetSubfolder(asset: AssetItem): string {
  const previewSubfolder = new URLSearchParams(
    (asset.preview_url ?? '').split('?')[1] ?? ''
  ).get('subfolder')
  if (previewSubfolder) return previewSubfolder
  const { subfolder } = asset.user_metadata ?? {}
  return typeof subfolder === 'string' ? subfolder : ''
}
