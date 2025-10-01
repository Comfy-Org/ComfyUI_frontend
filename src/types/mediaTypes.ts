/**
 * Media type constants and utilities
 * Single source of truth for supported media formats
 */

type MediaKind = 'image' | 'video' | 'audio' | 'unknown'

const MEDIA_MIME_TYPES = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const,
  video: ['video/mp4', 'video/webm'] as const,
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac'] as const
} as const

/**
 * Get accept attribute string for file inputs
 */
export function getAcceptString(kind: MediaKind): string | undefined {
  switch (kind) {
    case 'image':
      return MEDIA_MIME_TYPES.image.join(',')
    case 'video':
      return MEDIA_MIME_TYPES.video.join(',')
    case 'audio':
      return 'audio/*'
    default:
      return undefined
  }
}
