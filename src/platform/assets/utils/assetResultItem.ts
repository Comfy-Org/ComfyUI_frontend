import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { ResultItemImpl } from '@/stores/queueStore'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

export function assetToResultItem(asset: AssetItem): ResultItemImpl {
  class AssetResultItem extends ResultItemImpl {
    override get url(): string {
      return asset.preview_url ?? ''
    }

    override get previewUrl(): string {
      return asset.thumbnail_url ?? this.url
    }

    override get vhsAdvancedPreviewUrl(): string {
      return this.url
    }
  }

  const metadata = getOutputAssetMetadata(asset.user_metadata)
  return new AssetResultItem({
    assetId: asset.id,
    display_name: asset.display_name ?? undefined,
    filename: asset.name,
    format: metadata?.format,
    mediaType: getMediaTypeFromFilename(asset.name),
    nodeId: metadata?.nodeId ?? '',
    subfolder: metadata?.subfolder ?? '',
    type: 'output'
  })
}
