import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'

export type AttachmentValidationError = 'invalid-video' | 'unsupported-type'

export interface ComposerAttachment {
  id: string
  name: string
  ref: string
  sourceKey?: string
  previewUrl?: string
  mediaUrl?: string
  mediaKind?: MediaKind
  uploading?: boolean
  validationError?: AttachmentValidationError
}
