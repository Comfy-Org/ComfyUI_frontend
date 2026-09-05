import { clamp } from 'es-toolkit'

const DEFAULT_PREVIEW_FORMAT = 'webp;90'
const MIN_PREVIEW_SIZE = 512
const MAX_PREVIEW_SIZE = 8192

export function previewCompressionParams(options: {
  compressionEnabled: boolean
  previewFormat: string
  maxSize: number
}): string {
  const { compressionEnabled, previewFormat, maxSize } = options
  if (!compressionEnabled) {
    return previewFormat ? `&preview=${previewFormat}` : ''
  }
  const format = previewFormat || DEFAULT_PREVIEW_FORMAT
  const clampedSize = clamp(
    Math.round(maxSize),
    MIN_PREVIEW_SIZE,
    MAX_PREVIEW_SIZE
  )
  return `&preview=${format}&max_size=${clampedSize}`
}
