import { computed } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetMediaKind } from '@/platform/assets/utils/assetMetadataUtils'
import { getAssetSubfolder } from '@/platform/assets/utils/assetUrlUtil'
import { ResultItemImpl } from '@/stores/queueStore'

import type { IAssetsProvider } from './IAssetsProvider'
import { useFlatOutputAssets } from './useFlatOutputAssets'

function getAssetNodeId(asset: AssetItem): string | number {
  const nodeId = asset.user_metadata?.nodeId ?? asset.metadata?.node_id
  return typeof nodeId === 'string' || typeof nodeId === 'number' ? nodeId : '0'
}

function toResultItem(asset: AssetItem): ResultItemImpl {
  const mediaKind = getAssetMediaKind(asset)
  return new ResultItemImpl({
    filename: asset.name,
    subfolder: getAssetSubfolder(asset),
    type: 'output',
    nodeId: getAssetNodeId(asset),
    mediaType: mediaKind === 'image' ? 'images' : mediaKind,
    display_name: asset.display_name ?? undefined
  })
}

function groupByJobId(assets: AssetItem[]): AssetItem[] {
  const assetsByJobId = new Map<string, AssetItem[]>()
  for (const asset of assets) {
    if (!asset.job_id) continue
    const groupedAssets = assetsByJobId.get(asset.job_id)
    if (groupedAssets) {
      groupedAssets.push(asset)
    } else {
      assetsByJobId.set(asset.job_id, [asset])
    }
  }

  const seenJobIds = new Set<string>()
  return assets.flatMap((asset) => {
    const jobId = asset.job_id
    if (!jobId) return [asset]
    if (seenJobIds.has(jobId)) return []
    seenJobIds.add(jobId)

    const allOutputs = (assetsByJobId.get(jobId) ?? [asset]).map(toResultItem)
    const representativeOutput = allOutputs[0]
    return [
      {
        ...asset,
        user_metadata: {
          ...asset.user_metadata,
          jobId,
          nodeId: representativeOutput.nodeId,
          subfolder: representativeOutput.subfolder,
          outputCount: allOutputs.length,
          allOutputs
        }
      }
    ]
  })
}

export function useFlatOutputAssetsGrouped(): IAssetsProvider {
  const inner = useFlatOutputAssets()
  return {
    ...inner,
    media: computed(() => groupByJobId(inner.media.value))
  }
}
