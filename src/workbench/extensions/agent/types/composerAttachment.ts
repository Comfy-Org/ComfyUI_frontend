import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'

export interface ComposerAttachment {
  id: string
  name: string
  ref: string
  previewUrl?: string
  mediaUrl?: string
  mediaKind?: MediaKind
  uploading?: boolean
}
