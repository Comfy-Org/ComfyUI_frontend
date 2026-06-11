import { getCategoryOverrideForBase } from '@/components/sidebar/tabs/cloudModelLibrary/baseModelCategoryOverrides'
import {
  MODEL_GROUPS,
  groupIdForRawTag
} from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import { MODELS_TAG } from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetBaseModels } from '@/platform/assets/utils/assetMetadataUtils'

export function firstNonModelsTag(asset: AssetItem): string | null {
  for (const tag of asset.tags) {
    if (tag && tag !== MODELS_TAG) return tag
  }
  return null
}

export function rawTagTopLevel(tag: string): string {
  return tag.split('/')[0]
}

function categoryTagsForAsset(asset: AssetItem): string[] {
  return asset.tags.filter((tag) => tag && tag !== MODELS_TAG)
}

// The on-disk location of an asset. Folder tags describe what a model could
// be (a shared-folder file carries several); the reported file path records
// where it actually lives, which is what the disk view groups by.
export function directoryForAsset(asset: AssetItem): string | null {
  const candidates = [
    asset.file_path,
    asset.metadata?.file_path,
    asset.metadata?.filepath
  ]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate) continue
    const segments = candidate.split('/').slice(0, -1)
    if (segments[0] === 'models') segments.shift()
    const directory = segments.join('/')
    if (directory) return directory
  }
  return firstNonModelsTag(asset)
}

export interface AssetGrouping {
  /** Curated group ids the asset belongs to (deduplicated). */
  groupIds: string[]
  /** Top-level raw tags with no curated mapping (deduplicated). */
  unmappedTags: string[]
}

/**
 * Resolves every group an asset belongs to. An asset may carry multiple
 * category tags (the backend tags a file with every model folder it could
 * belong to, e.g. a file in a shared folder gets both `checkpoints` and
 * `loras`), and membership in multiple groups is the intended behavior.
 * Tags with no curated mapping surface verbatim so new categories and user
 * folders stay visible.
 */
export function groupAsset(asset: AssetItem): AssetGrouping {
  const groupIds = new Set<string>()
  const unmappedTags = new Set<string>()
  for (const tag of categoryTagsForAsset(asset)) {
    const groupId = groupIdForTag(asset, tag)
    if (groupId) {
      groupIds.add(groupId)
    } else {
      unmappedTags.add(rawTagTopLevel(tag))
    }
  }
  return { groupIds: [...groupIds], unmappedTags: [...unmappedTags] }
}

export function groupLabelForAsset(asset: AssetItem): string {
  const { groupIds, unmappedTags } = groupAsset(asset)
  if (groupIds.length > 0) {
    const group = MODEL_GROUPS.find((g) => g.id === groupIds[0])
    if (group) return group.label
  }
  return unmappedTags[0] ?? ''
}

export function partnerKind(category: string | undefined): string {
  if (!category) return ''
  const parts = category.split('/')
  return parts[1] ?? ''
}

function groupIdForTag(asset: AssetItem, tag: string): string | null {
  const tagGroup = groupIdForRawTag(rawTagTopLevel(tag))
  // Cross-base file-types stay in their type bucket. The Base-model sort
  // axis still keeps each family's items grouped together within that bucket.
  if (
    tagGroup === 'loras' ||
    tagGroup === 'vae' ||
    tagGroup === 'conditioning'
  ) {
    return tagGroup
  }
  // Filename-based VAE detection: any file with "vae" in any path segment of
  // its tag, name, or filepath belongs in the VAE bucket — catches assets
  // tagged generically (`latentsync/vae`, `CogVideo/VAE`, `SEEDVR2`) or named
  // `*_vae_*` but tagged as something else.
  if (looksLikeVae(asset, tag)) return 'vae'
  // For everything else, let the resolved base model's primary category
  // override the file-type-derived bucket — keeps a family's text encoders
  // and checkpoints visible together rather than scattered.
  const bases = getAssetBaseModels(asset)
  for (const base of bases) {
    const override = getCategoryOverrideForBase(base)
    if (override) return override
  }
  return tagGroup
}

export function looksLikeVae(asset: AssetItem, tag: string): boolean {
  // Any path segment of the tag containing "vae" (handles `latentsync/vae`,
  // `CogVideo/VAE`, etc.)
  for (const segment of tag.split('/')) {
    if (/^vae(_approx)?$/i.test(segment)) return true
  }
  // "vae" appearing as a word in the filename / display name
  const sources = [
    asset.name,
    typeof asset.metadata?.filename === 'string'
      ? asset.metadata.filename
      : undefined,
    typeof asset.metadata?.filepath === 'string'
      ? asset.metadata.filepath
      : undefined
  ]
  for (const source of sources) {
    if (typeof source !== 'string') continue
    if (/(?:^|[^a-zA-Z0-9])vae(?:[^a-zA-Z0-9]|$)/i.test(source)) return true
  }
  return false
}
