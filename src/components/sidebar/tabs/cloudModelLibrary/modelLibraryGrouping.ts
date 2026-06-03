import { getCategoryOverrideForBase } from '@/components/sidebar/tabs/cloudModelLibrary/baseModelCategoryOverrides'
import {
  MODEL_GROUPS,
  groupIdForRawTag
} from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import { MODELS_TAG } from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetBaseModels } from '@/platform/assets/utils/assetMetadataUtils'
import { formatCategoryLabel } from '@/platform/assets/utils/categoryLabel'

export function firstNonModelsTag(asset: AssetItem): string | null {
  for (const tag of asset.tags) {
    if (tag && tag !== MODELS_TAG) return tag
  }
  return null
}

export function rawTagTopLevel(tag: string): string {
  return tag.split('/')[0]
}

export function groupLabelForAsset(asset: AssetItem): string {
  const groupId = groupIdForAsset(asset)
  if (groupId) {
    const group = MODEL_GROUPS.find((g) => g.id === groupId)
    if (group) return group.label
  }
  const tag = firstNonModelsTag(asset)
  return tag ? formatCategoryLabel(rawTagTopLevel(tag)) : ''
}

export function partnerKind(category: string | undefined): string {
  if (!category) return ''
  const parts = category.split('/')
  return parts[1] ?? ''
}

export function groupIdForAsset(asset: AssetItem): string | null {
  const tag = firstNonModelsTag(asset)
  if (!tag) return null
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
