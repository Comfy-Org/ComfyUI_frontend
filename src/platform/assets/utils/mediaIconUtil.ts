import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'

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

const FILE_IMAGE_ICON = 'icon-[lucide--file-image]'
const FILE_VIDEO_ICON = 'icon-[lucide--file-video]'
const FILE_AUDIO_ICON = 'icon-[lucide--file-audio]'
const FILE_TEXT_ICON = 'icon-[lucide--file-text]'
const FILE_GENERIC_ICON = 'icon-[lucide--file]'
const BOX_ICON = 'icon-[lucide--box]'

const THREE_D_MIME_TYPES = new Set<string>([
  'model/gltf-binary',
  'model/gltf+json',
  'model/obj',
  'model/vnd.usdz+zip'
])

// MIME-type → icon resolver. Generalises `iconForMediaType` for callers that
// have an authoritative MIME type instead of a media-family enum. Used by
// asset cards and previews to render a deliberate file-type icon when the
// browser cannot decode the asset for in-place display (EXR, RAW, latents,
// .safetensors, etc.) rather than the misleading broken-image state.
export function iconForMimeType(mimeType: string | null | undefined): string {
  if (!mimeType) return FILE_GENERIC_ICON
  const normalized = mimeType.toLowerCase().split(';')[0].trim()
  const family = normalized.split('/')[0]

  if (THREE_D_MIME_TYPES.has(normalized) || family === 'model') return BOX_ICON

  switch (family) {
    case 'image':
      return FILE_IMAGE_ICON
    case 'video':
      return FILE_VIDEO_ICON
    case 'audio':
      return FILE_AUDIO_ICON
    case 'text':
      return FILE_TEXT_ICON
    default:
      return FILE_GENERIC_ICON
  }
}
