const MAX_THUMBNAIL_EDGE_PX = 768
const THUMBNAIL_MIME_TYPE = 'image/webp'
const THUMBNAIL_QUALITY = 0.85
const VIDEO_FRAME_SECONDS = 1

function drawScaled(
  source: CanvasImageSource,
  width: number,
  height: number
): string {
  const scale = Math.min(1, MAX_THUMBNAIL_EDGE_PX / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(THUMBNAIL_MIME_TYPE, THUMBNAIL_QUALITY)
}

async function imageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    return drawScaled(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

function videoFrameToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  return new Promise<string>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(VIDEO_FRAME_SECONDS, video.duration / 2)
    })
    video.addEventListener('seeked', () => {
      resolve(drawScaled(video, video.videoWidth, video.videoHeight))
    })
    video.addEventListener('error', () => reject(video.error))
    video.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

/**
 * A small still image for a template card: the image itself, scaled down, or
 * one frame of a video.
 */
export async function fileToThumbnailDataUrl(
  file: File
): Promise<string | null> {
  try {
    if (file.type.startsWith('video/')) return await videoFrameToDataUrl(file)
    if (file.type.startsWith('image/')) return await imageToDataUrl(file)
    return null
  } catch {
    return null
  }
}
