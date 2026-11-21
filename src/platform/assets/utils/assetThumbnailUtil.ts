import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { resolveMediaSrc } from '@/platform/assets/utils/assetUrlUtil'
import { iconForFilename } from '@/platform/assets/utils/mediaIconUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { hdrPreviewAssetUrl, isHdrImageFilename } from '@/utils/hdrFormatUtil'

export interface Thumbnail {
  src?: string
  icon: string
  isVideo: boolean
}

type ThumbnailSource = Pick<AssetItem, 'name'> &
  Partial<Pick<AssetItem, 'preview_id' | 'preview_url' | 'thumbnail_url'>>

function thumbnailSrc(asset: ThumbnailSource): string | undefined {
  if (isHdrImageFilename(asset.name))
    return asset.preview_id
      ? hdrPreviewAssetUrl(asset.preview_id)
      : resolveMediaSrc(asset.thumbnail_url) || undefined
  const mediaType = getMediaTypeFromFilename(asset.name)
  if (mediaType === 'image')
    return (
      resolveMediaSrc(asset.thumbnail_url || asset.preview_url) || undefined
    )
  if (mediaType === 'video')
    return resolveMediaSrc(asset.preview_url) || undefined
  return undefined
}

export function assetThumbnail(asset: ThumbnailSource): Thumbnail {
  return {
    src: thumbnailSrc(asset),
    icon: iconForFilename(asset.name),
    isVideo: getMediaTypeFromFilename(asset.name) === 'video'
  }
}
