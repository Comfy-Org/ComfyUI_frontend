import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'

export function iconForMediaType(mediaType: MediaKind): string {
  switch (mediaType) {
    case 'video':
      return 'icon-[lucide--video]'
    case 'audio':
      return 'icon-[lucide--music]'
    case '3D':
      return 'icon-[lucide--box]'
    default:
      return 'icon-[lucide--image]'
  }
}
