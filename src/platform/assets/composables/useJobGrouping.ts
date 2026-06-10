import { computed } from 'vue'
import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

export interface JobGroup {
  /** Stable key: the job id, or a per-asset key for assets without one. */
  key: string
  jobId: string | null
  /** First group member in display order; shown as the group's card. */
  representative: AssetItem
  assets: AssetItem[]
}

/**
 * Client-side group-by-job over the loaded (already filtered and sorted)
 * asset list. Assets without a job_id form singleton groups. Group order
 * and each group's representative follow first occurrence in display order,
 * so grouping works under any active sort.
 *
 * While more pages exist under a time sort, the group containing the last
 * loaded asset may still be split across the page boundary; `holdBackTrailing`
 * hides it until the next page lands (or streams exhaust) to avoid
 * undercounting.
 */
export function useJobGrouping(options: {
  assets: Ref<AssetItem[]>
  enabled: Ref<boolean>
  holdBackTrailing: Ref<boolean>
}) {
  const { assets, enabled, holdBackTrailing } = options

  const groups = computed<JobGroup[]>(() => {
    if (!enabled.value) return []

    const byKey = new Map<string, JobGroup>()
    for (const asset of assets.value) {
      const key = asset.job_id ?? `asset:${asset.id}`
      const group = byKey.get(key)
      if (group) {
        group.assets.push(asset)
      } else {
        byKey.set(key, {
          key,
          jobId: asset.job_id ?? null,
          representative: asset,
          assets: [asset]
        })
      }
    }

    const result = [...byKey.values()]
    if (holdBackTrailing.value && result.length > 1) {
      const lastAsset = assets.value[assets.value.length - 1]
      const trailingKey = lastAsset.job_id ?? `asset:${lastAsset.id}`
      return result.filter((group) => group.key !== trailingKey)
    }
    return result
  })

  const groupsByAssetId = computed(() => {
    const map = new Map<string, JobGroup>()
    for (const group of groups.value) {
      for (const asset of group.assets) {
        map.set(asset.id, group)
      }
    }
    return map
  })

  /** Representatives in display order; the grid renders one card per group. */
  const groupedAssets = computed<AssetItem[]>(() => {
    if (!enabled.value) return assets.value
    return groups.value.map((group) => group.representative)
  })

  function getGroup(asset: AssetItem): JobGroup | undefined {
    return groupsByAssetId.value.get(asset.id)
  }

  function getGroupCount(asset: AssetItem): number {
    return getGroup(asset)?.assets.length ?? 1
  }

  return {
    groupedAssets,
    getGroup,
    getGroupCount
  }
}
