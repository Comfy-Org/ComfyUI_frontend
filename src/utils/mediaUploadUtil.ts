/** Accepted MIME types for the image upload file picker. */
export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp'

/** Accepted MIME types for the video upload file picker. */
export const ACCEPTED_VIDEO_TYPES = 'video/webm,video/mp4'

export function hasFilenameExtension(file: File) {
  return /[^./\\]\.[^.\s/\\]+$/.test(file.name)
}

export function isUploadableVideo(file: File) {
  return file.type.startsWith('video/') && hasFilenameExtension(file)
}
