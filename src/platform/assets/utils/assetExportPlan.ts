import type { CreateAssetExportData } from '@comfyorg/ingest-types'

import type { AssetItem } from '@comfyorg/assets-core/schema'
import { getOutputAssetMetadata } from '@/platform/assets/types/outputAssetMetadata'
import { getAssetType } from '@comfyorg/assets-core/metadata'
import { resolveOutputAssetItems } from '@/platform/assets/adapters/outputAssetResolver'

export function hasGroupedAssetOutputs(assets: AssetItem[]): boolean {
  return assets.some((asset) => {
    const count = getOutputAssetMetadata(asset.user_metadata)?.outputCount
    return typeof count === 'number' && count > 1
  })
}

export async function expandAssetsForDownload(assets: AssetItem[]) {
  const expanded = await Promise.all(
    assets.map(async (asset) => {
      if (!hasGroupedAssetOutputs([asset])) return [asset]
      const metadata = getOutputAssetMetadata(asset.user_metadata)
      if (!metadata) return [asset]
      try {
        const resolved = await resolveOutputAssetItems(metadata, {
          createdAt: asset.created_at
        })
        return resolved.length > 0 ? resolved : [asset]
      } catch (error) {
        console.error('Failed to expand grouped asset for download:', error)
        return [asset]
      }
    })
  )
  const seen = new Set<string>()
  return expanded.flat().filter((asset) => {
    if (seen.has(asset.id)) return false
    seen.add(asset.id)
    return true
  })
}

export function buildAssetExportRequest(
  assets: AssetItem[]
): CreateAssetExportData['body'] {
  const jobIds = new Set<string>()
  const assetIds: string[] = []
  const namesByJobId = new Map<string, Set<string>>()
  const wholeJobIds = new Set<string>()

  for (const asset of assets) {
    const assetType = getAssetType(asset)
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    const jobId = metadata?.jobId
    if (!jobId || (assetType !== 'output' && assetType !== 'temp')) {
      assetIds.push(asset.id)
      continue
    }
    jobIds.add(jobId)
    if (metadata.outputCount != null) {
      wholeJobIds.add(jobId)
      continue
    }
    if (!asset.name) continue
    const names = namesByJobId.get(jobId) ?? new Set<string>()
    names.add(asset.name)
    namesByJobId.set(jobId, names)
  }

  const jobAssetNameFilters = Object.fromEntries(
    [...namesByJobId]
      .filter(([jobId]) => !wholeJobIds.has(jobId))
      .map(([jobId, names]): [string, string[]] => [jobId, [...names]])
  )

  return {
    ...(jobIds.size > 0 ? { job_ids: [...jobIds] } : {}),
    ...(assetIds.length > 0 ? { asset_ids: assetIds } : {}),
    ...(Object.keys(jobAssetNameFilters).length > 0
      ? { job_asset_name_filters: jobAssetNameFilters }
      : {}),
    naming_strategy: jobIds.size > 1 ? 'group_by_job_time' : 'preserve',
    include_previews: true
  }
}
