/**
 * Pure helpers for merging multiple paginated asset streams (one per tag)
 * into a single list ordered by the active sort key.
 *
 * The assets API's `include_tags` filter uses AND semantics, so showing
 * outputs together with previews (or the All tab) requires one request
 * stream per tag, unioned client-side.
 */
import type {
  AssetSortField,
  AssetSortOrder
} from '@/platform/assets/services/assetService'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

export interface AssetSortSpec {
  sort: AssetSortField
  order: AssetSortOrder
}

export interface AssetStreamState {
  tag: string
  items: AssetItem[]
  offset: number
  hasMore: boolean
}

function sortValue(asset: AssetItem, field: AssetSortField): number | string {
  switch (field) {
    case 'name':
      return asset.name
    case 'size':
      return asset.size ?? 0
    case 'updated_at':
      return asset.updated_at ? new Date(asset.updated_at).getTime() : 0
    case 'created_at':
      return asset.created_at ? new Date(asset.created_at).getTime() : 0
  }
}

/**
 * Compare two assets under a sort spec. Returns negative when `a` comes
 * before `b` in display order.
 */
export function compareAssets(
  a: AssetItem,
  b: AssetItem,
  spec: AssetSortSpec
): number {
  const va = sortValue(a, spec.sort)
  const vb = sortValue(b, spec.sort)
  const cmp =
    typeof va === 'string' && typeof vb === 'string'
      ? va.localeCompare(vb)
      : Number(va) - Number(vb)
  return spec.order === 'asc' ? cmp : -cmp
}

/**
 * Merge stream items into one deduped list ordered by the sort spec.
 *
 * While any stream still has more pages, items sorting after that stream's
 * frontier (its last loaded item) are held back: they could be preceded by
 * not-yet-loaded items from that stream, so emitting them would show gaps.
 */
export function mergeAssetStreams(
  streams: AssetStreamState[],
  spec: AssetSortSpec
): AssetItem[] {
  const seen = new Set<string>()
  const merged: AssetItem[] = []
  for (const stream of streams) {
    for (const item of stream.items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
    }
  }
  merged.sort((a, b) => compareAssets(a, b, spec))

  const frontiers = streams
    .filter((stream) => stream.hasMore && stream.items.length > 0)
    .map((stream) => stream.items[stream.items.length - 1])
  if (frontiers.length === 0) return merged

  const limit = frontiers.reduce((min, frontier) =>
    compareAssets(frontier, min, spec) < 0 ? frontier : min
  )
  return merged.filter((item) => compareAssets(item, limit, spec) <= 0)
}

/**
 * Pick the stream to advance on loadMore: the unexhausted stream whose
 * frontier is least advanced in display order (an unexhausted stream with
 * nothing loaded yet always wins). Returns -1 when all streams are done.
 */
export function pickNextStream(
  streams: AssetStreamState[],
  spec: AssetSortSpec
): number {
  let best = -1
  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i]
    if (!stream.hasMore) continue
    if (stream.items.length === 0) return i
    if (best === -1) {
      best = i
      continue
    }
    const bestItems = streams[best].items
    const frontier = stream.items[stream.items.length - 1]
    const bestFrontier = bestItems[bestItems.length - 1]
    if (compareAssets(frontier, bestFrontier, spec) < 0) {
      best = i
    }
  }
  return best
}
