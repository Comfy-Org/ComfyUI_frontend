/** Accepted MIME types for the image upload file picker. */
export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp'

/** Accepted MIME types for the video upload file picker. */
export const ACCEPTED_VIDEO_TYPES = 'video/webm,video/mp4'

export function hasFilenameExtension(file: File) {
  return /^\.*[^.].*\.[^.\s/\\]+$/.test(file.name)
}

export function isUploadableVideo(file: File) {
  return file.type.startsWith('video/') && hasFilenameExtension(file)
}

export function isExtensionlessVideo(file: File) {
  return file.type.startsWith('video/') && !hasFilenameExtension(file)
}

/** Extensionless file on a video-only route, where the browser may report no MIME type. */
export function isUntypedOrVideoWithoutExtension(file: File) {
  return (
    (file.type === '' || file.type.startsWith('video/')) &&
    !hasFilenameExtension(file)
  )
}

const LEGACY_EMPTY_MEDIA_VALUES: ReadonlySet<string> = new Set([
  '',
  '(none)',
  'none',
  'None'
])

/** The filenames selected in a list-valued media picker, reading a saved single filename or a `(none)`, `none`, or `None` sentinel from before the node declared `min` or `max`. */
export function toMediaSelection(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((name): name is string => typeof name === 'string')
  if (typeof value !== 'string' || LEGACY_EMPTY_MEDIA_VALUES.has(value))
    return []
  return [value]
}
