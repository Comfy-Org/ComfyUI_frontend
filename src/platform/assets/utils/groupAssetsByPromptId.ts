import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

/**
 * Group flat output assets by prompt_id.
 * Returns one representative AssetItem per group with outputCount in user_metadata.
 */
export function groupAssetsByPromptId(assets: AssetItem[]): AssetItem[] {
  const groups = new Map<string, AssetItem[]>()

  for (const asset of assets) {
    const key = asset.prompt_id ?? asset.id
    const group = groups.get(key)
    if (group) {
      group.push(asset)
    } else {
      groups.set(key, [asset])
    }
  }

  const grouped: AssetItem[] = []
  for (const [, group] of groups) {
    const representative = group[0]
    grouped.push({
      ...representative,
      user_metadata: {
        ...representative.user_metadata,
        outputCount: group.length
      }
    })
  }

  return grouped.sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime()
  )
}
