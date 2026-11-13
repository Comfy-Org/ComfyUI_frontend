import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

export function iconForMediaType(mediaType: MediaKind): string {
  switch (mediaType) {
    case 'video':
      return 'icon-[lucide--video]'
    case 'audio':
      return 'icon-[lucide--music]'
    case '3D':
      return 'icon-[lucide--box]'
    case 'text':
      return 'icon-[lucide--text]'
    case 'other':
      return 'icon-[lucide--check-check]'
    default:
      return 'icon-[lucide--image]'
  }
}

export function iconForFilename(filename: string): string {
  return isHdrImageFilename(filename)
    ? 'icon-[lucide--sun]'
    : iconForMediaType(getMediaTypeFromFilename(filename))
}
