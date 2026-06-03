import { formatRowDisplayName } from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetBaseModels,
  getAssetDisplayName
} from '@/platform/assets/utils/assetMetadataUtils'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

type AssetEntry = { kind: 'asset'; asset: AssetItem }
type PartnerEntry = { kind: 'partner'; nodeDef: ComfyNodeDefImpl }
export type SidebarItem = AssetEntry | PartnerEntry

export type ProviderGroup = { provider: string; items: SidebarItem[] }
export type Section = {
  id: string
  label: string
  providers: ProviderGroup[]
  totalCount: number
}

export type SortMode =
  | 'recent'
  | 'oldest'
  | 'nameAsc'
  | 'nameDesc'
  | 'baseModelAsc'
  | 'baseModelDesc'

const UNKNOWN_BASE_MODEL_LABEL = '—'

function itemSortKey(item: SidebarItem): string {
  return item.kind === 'asset'
    ? formatRowDisplayName(getAssetDisplayName(item.asset))
    : (item.nodeDef.display_name ?? item.nodeDef.name)
}

function itemTimestamp(item: SidebarItem): number {
  if (item.kind !== 'asset') return 0
  const ts = item.asset.created_at ?? item.asset.updated_at
  if (!ts) return 0
  const parsed = Date.parse(ts)
  return Number.isNaN(parsed) ? 0 : parsed
}

function compareByName(a: SidebarItem, b: SidebarItem): number {
  return itemSortKey(a).localeCompare(itemSortKey(b), undefined, {
    sensitivity: 'base'
  })
}

function compareByMode(a: SidebarItem, b: SidebarItem, mode: SortMode): number {
  switch (mode) {
    case 'recent':
      return itemTimestamp(b) - itemTimestamp(a) || compareByName(a, b)
    case 'oldest':
      return itemTimestamp(a) - itemTimestamp(b) || compareByName(a, b)
    case 'nameDesc':
    case 'baseModelDesc':
      return -compareByName(a, b)
    case 'nameAsc':
    case 'baseModelAsc':
    default:
      return compareByName(a, b)
  }
}

function isBaseModelMode(mode: SortMode): boolean {
  return mode === 'baseModelAsc' || mode === 'baseModelDesc'
}

function itemBaseModels(item: SidebarItem): string[] {
  if (item.kind === 'asset') return getAssetBaseModels(item.asset)
  return []
}

export function buildProviderGroups(
  items: SidebarItem[],
  mode: SortMode,
  isSearching: boolean
): ProviderGroup[] {
  // When a search is active, preserve Fuse's relevance ranking instead of
  // re-sorting by the user's chosen sort mode.
  if (isSearching) {
    return [{ provider: '', items: items.slice() }]
  }
  if (!isBaseModelMode(mode)) {
    return [
      {
        provider: '',
        items: items.slice().sort((a, b) => compareByMode(a, b, mode))
      }
    ]
  }

  // Items with multiple compatible base models show under each. Items with
  // no known base land in a trailing "—" bucket.
  const buckets = new Map<string, SidebarItem[]>()
  for (const item of items) {
    const bases = itemBaseModels(item)
    if (bases.length === 0) {
      const list = buckets.get(UNKNOWN_BASE_MODEL_LABEL) ?? []
      list.push(item)
      buckets.set(UNKNOWN_BASE_MODEL_LABEL, list)
      continue
    }
    for (const base of bases) {
      const list = buckets.get(base) ?? []
      list.push(item)
      buckets.set(base, list)
    }
  }
  const direction = mode === 'baseModelDesc' ? -1 : 1
  const labels = Array.from(buckets.keys()).sort((a, b) => {
    if (a === UNKNOWN_BASE_MODEL_LABEL && b !== UNKNOWN_BASE_MODEL_LABEL)
      return 1
    if (b === UNKNOWN_BASE_MODEL_LABEL && a !== UNKNOWN_BASE_MODEL_LABEL)
      return -1
    return direction * a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
  return labels.map((label) => ({
    provider: label,
    items: (buckets.get(label) ?? []).slice().sort(compareByName)
  }))
}
