import { computed } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import type { IAssetsProvider } from './IAssetsProvider'
import { useFlatOutputAssets } from './useFlatOutputAssets'

/**
 * Cloud `/api/assets?include_tags=output` returns one row per individual output
 * file. The asset sidebar's stack UX expects one card per job with an
 * `outputCount` badge, so collapse rows that share a `job_id` into a single
 * representative (the first occurrence — assets are returned newest-first).
 *
 * The siblings remain reachable through the existing stack-expand path via
 * `resolveOutputAssetItems(metadata)`.
 */
export function useFlatOutputAssetsGrouped(): IAssetsProvider {
  const inner = useFlatOutputAssets()

  const media = computed(() => groupByJobId(inner.media.value))

  return {
    ...inner,
    media
  }
}

function groupByJobId(assets: AssetItem[]): AssetItem[] {
  const countsByJobId = new Map<string, number>()
  for (const asset of assets) {
    const jobId = asset.job_id ?? asset.prompt_id
    if (!jobId) continue
    countsByJobId.set(jobId, (countsByJobId.get(jobId) ?? 0) + 1)
  }

  const seenJobIds = new Set<string>()
  const grouped: AssetItem[] = []
  for (const asset of assets) {
    const jobId = asset.job_id ?? asset.prompt_id ?? null
    if (!jobId) {
      grouped.push(asset)
      continue
    }
    if (seenJobIds.has(jobId)) continue
    seenJobIds.add(jobId)

    const outputCount = countsByJobId.get(jobId) ?? 1
    grouped.push({
      ...asset,
      user_metadata: {
        ...asset.user_metadata,
        jobId,
        outputCount
      }
    })
  }
  return grouped
}
