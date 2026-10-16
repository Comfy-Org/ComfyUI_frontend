import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetContentUrl } from '@/platform/assets/utils/assetUrlUtil'
import { iconForFilename } from '@/platform/assets/utils/mediaIconUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

export interface Thumbnail {
  src?: string
  icon: string
  isVideo: boolean
}

function thumbnailSrc(asset: AssetItem): string | undefined {
  if (isHdrImageFilename(asset.name))
    return asset.preview_id ? assetContentUrl(asset.preview_id) : undefined
  const mediaType = getMediaTypeFromFilename(asset.name)
  if (mediaType === 'image')
    return asset.thumbnail_url || asset.preview_url || undefined
  if (mediaType === 'video') return asset.preview_url || undefined
  return undefined
}

export function assetThumbnail(asset: AssetItem): Thumbnail {
  return {
    src: thumbnailSrc(asset),
    icon: iconForFilename(asset.name),
    isVideo: getMediaTypeFromFilename(asset.name) === 'video'
  }
}
