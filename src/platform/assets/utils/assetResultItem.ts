import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

export function assetToResultItem(asset: AssetItem): AugmentedResultItem {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  const url = asset.preview_url ?? ''
  return {
    assetId: asset.id,
    display_name: asset.display_name ?? undefined,
    filename: asset.name,
    format: metadata?.format,
    mediaType: getMediaTypeFromFilename(asset.name),
    nodeId: metadata?.nodeId ?? '',
    subfolder: metadata?.subfolder ?? '',
    type: 'output',
    url,
    previewUrl: asset.thumbnail_url ?? url
  }
}
