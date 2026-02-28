import { isCloud } from './types'

const CLOUD_PREVIEW_RES = 512

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'tif'
])

function isImageFilename(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ext ? IMAGE_EXTENSIONS.has(ext) : false
}

/**
 * Returns `&res=N` for cloud image preview URLs.
 * The cloud backend resizes images server-side to prevent
 * the frontend from loading very large images.
 *
 * Returns empty string when not in cloud mode or for non-image files.
 */
export function getCloudResParam(filename?: string): string {
  if (!isCloud) return ''
  if (filename && !isImageFilename(filename)) return ''
  return `&res=${CLOUD_PREVIEW_RES}`
}
