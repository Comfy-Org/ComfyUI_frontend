import {
  MODEL_GROUPS,
  groupIdForRawTag
} from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import { MODELS_TAG } from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

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
 * Resolves every group an asset belongs to — a pure remapping of its folder
 * tags onto the curated groups. An asset may carry multiple category tags
 * (the backend tags a file with every model folder it could belong to, e.g.
 * a file in a shared folder gets both `checkpoints` and `loras`), and
 * membership in multiple groups is the intended behavior. Tags with no
 * curated mapping surface verbatim so new categories and user folders stay
 * visible.
 */
export function groupAsset(asset: AssetItem): AssetGrouping {
  const groupIds = new Set<string>()
  const unmappedTags = new Set<string>()
  for (const tag of categoryTagsForAsset(asset)) {
    const groupId = groupIdForRawTag(rawTagTopLevel(tag))
    if (groupId) {
      groupIds.add(groupId)
    } else {
      unmappedTags.add(rawTagTopLevel(tag))
    }
  }
  return { groupIds: [...groupIds], unmappedTags: [...unmappedTags] }
}

export interface PlacedAsset {
  asset: AssetItem
  /** Path below the section root ('' = directly in it). */
  subpath: string
}

interface RawPlacement {
  asset: AssetItem
  top: string
  rest: string
}

// Backends tag both a folder and its parents (`checkpoints/sdxl` plus
// `checkpoints`); within one bucket only the deepest path counts.
function dropPrefixPlacements(placements: RawPlacement[]): RawPlacement[] {
  return placements.filter(
    (p, index) =>
      !placements.some(
        (q, qIndex) =>
          q.top === p.top &&
          qIndex !== index &&
          (q.rest === p.rest
            ? qIndex < index
            : q.rest.startsWith(p.rest ? `${p.rest}/` : ''))
      )
  )
}

/**
 * Places every asset into its curated groups and unmapped-tag buckets,
 * preserving the user's sub-folder organisation as a subpath. When a group
 * merges several disk roots (Diffusion models absorbs both `checkpoints`
 * and `diffusion_models`) the root segment stays as the first subpath level
 * so distinct disk folders never silently merge.
 */
export function placeAssetsInGroups(assets: AssetItem[]): {
  byGroup: Map<string, PlacedAsset[]>
  unmappedByTag: Map<string, PlacedAsset[]>
} {
  const groupPlacements = new Map<string, RawPlacement[]>()
  const unmappedPlacements = new Map<string, RawPlacement[]>()

  for (const asset of assets) {
    const byBucket = new Map<string, RawPlacement[]>()
    for (const tag of categoryTagsForAsset(asset)) {
      const top = rawTagTopLevel(tag)
      const rest = tag.split('/').slice(1).join('/')
      const groupId = groupIdForRawTag(top)
      const bucket = groupId ?? `tag:${top}`
      const list = byBucket.get(bucket) ?? []
      list.push({ asset, top, rest })
      byBucket.set(bucket, list)
    }
    for (const [bucket, placements] of byBucket) {
      const deduped = dropPrefixPlacements(placements)
      const target = bucket.startsWith('tag:')
        ? unmappedPlacements
        : groupPlacements
      const key = bucket.startsWith('tag:') ? bucket.slice(4) : bucket
      target.set(key, [...(target.get(key) ?? []), ...deduped])
    }
  }

  const byGroup = new Map<string, PlacedAsset[]>()
  for (const [groupId, placements] of groupPlacements) {
    const roots = new Set(placements.map((p) => p.top))
    byGroup.set(
      groupId,
      placements.map(({ asset, top, rest }) => ({
        asset,
        subpath: roots.size > 1 ? (rest ? `${top}/${rest}` : top) : rest
      }))
    )
  }
  const unmappedByTag = new Map<string, PlacedAsset[]>()
  for (const [tag, placements] of unmappedPlacements) {
    unmappedByTag.set(
      tag,
      placements.map(({ asset, rest }) => ({ asset, subpath: rest }))
    )
  }
  return { byGroup, unmappedByTag }
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
