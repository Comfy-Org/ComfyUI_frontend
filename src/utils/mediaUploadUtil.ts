/** Accepted MIME types for the image upload file picker. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.heif',
  '.jxl',
  '.svg',
  '.tif',
  '.tiff'
].join(',')

/** Accepted MIME types for the video upload file picker. */
export const ACCEPTED_VIDEO_TYPES = [
  'video/webm',
  'video/mp4',
  '.avi',
  '.flv',
  '.m4v',
  '.mkv',
  '.mov',
  '.wmv'
].join(',')

export function hasFilenameExtension(file: File) {
  return /^\.*[^.].*\.[^.\s/\\]+$/.test(file.name)
}

export function isUploadableVideo(file: File) {
  return file.type.startsWith('video/') && hasFilenameExtension(file)
}

export function isExtensionlessVideo(file: File) {
  return file.type.startsWith('video/') && !hasFilenameExtension(file)
}
