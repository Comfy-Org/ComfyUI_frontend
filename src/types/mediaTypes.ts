/**
 * Media type constants and utilities
 * Single source of truth for supported media formats
 */

export type MediaKind = 'image' | 'video' | 'audio' | 'unknown'

export const MEDIA_EXTENSIONS = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'] as const,
  video: ['.mp4', '.webm', '.mov', '.avi'] as const,
  audio: ['.mp3', '.wav', '.ogg', '.flac'] as const
} as const

export const MEDIA_MIME_TYPES = {
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

/**
 * Detect media type from URL or filename
 */
export function getMediaKindFromUrl(url: string): MediaKind {
  if (!url) return 'unknown'

  try {
    const urlObj = new URL(url, window.location.origin)
    const filename = urlObj.searchParams.get('filename') || urlObj.pathname
    const lowerFilename = filename.toLowerCase()

    if (MEDIA_EXTENSIONS.video.some((ext) => lowerFilename.endsWith(ext))) {
      return 'video'
    }
    if (MEDIA_EXTENSIONS.image.some((ext) => lowerFilename.endsWith(ext))) {
      return 'image'
    }
    if (MEDIA_EXTENSIONS.audio.some((ext) => lowerFilename.endsWith(ext))) {
      return 'audio'
    }
  } catch {
    // Fallback for non-URL strings
    const lowerSrc = url.toLowerCase()
    if (MEDIA_EXTENSIONS.video.some((ext) => lowerSrc.includes(ext))) {
      return 'video'
    }
    if (MEDIA_EXTENSIONS.image.some((ext) => lowerSrc.includes(ext))) {
      return 'image'
    }
    if (MEDIA_EXTENSIONS.audio.some((ext) => lowerSrc.includes(ext))) {
      return 'audio'
    }
  }

  return 'unknown'
}

/**
 * Check if URL is a video
 */
export function isVideoUrl(url: string): boolean {
  return getMediaKindFromUrl(url) === 'video'
}

/**
 * Check if URL is an image
 */
export function isImageUrl(url: string): boolean {
  return getMediaKindFromUrl(url) === 'image'
}
