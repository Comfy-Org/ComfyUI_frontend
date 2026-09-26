export interface WorkshopVideoMetadata {
  readonly durationSeconds: number
  readonly widthPixels: number
  readonly heightPixels: number
}

export interface WorkshopImageMetadata {
  readonly widthPixels: number
  readonly heightPixels: number
}

export async function readWorkshopImageMetadata(
  source: File | string,
  signal: AbortSignal
): Promise<WorkshopImageMetadata> {
  signal.throwIfAborted()
  const image = new Image()
  const sourceUrl =
    typeof source === 'string' ? source : URL.createObjectURL(source)

  try {
    const metadata = await new Promise<WorkshopImageMetadata>(
      (resolve, reject) => {
        const abort = () => finish(undefined, signal.reason)
        const fail = () =>
          finish(
            undefined,
            new DOMException(
              'Image metadata could not be read',
              'NotSupportedError'
            )
          )
        const timer = setTimeout(
          () =>
            finish(
              undefined,
              new DOMException('Image metadata timed out', 'TimeoutError')
            ),
          15_000
        )

        function finish(value?: WorkshopImageMetadata, error?: unknown) {
          clearTimeout(timer)
          signal.removeEventListener('abort', abort)
          image.onload = null
          image.onerror = null
          if (value === undefined) reject(error)
          else resolve(value)
        }

        image.onload = () => {
          const value = {
            widthPixels: image.naturalWidth,
            heightPixels: image.naturalHeight
          }
          if (
            Object.values(value).every(
              (measurement) => Number.isFinite(measurement) && measurement > 0
            )
          )
            finish(value)
          else fail()
        }
        image.onerror = fail
        signal.addEventListener('abort', abort, { once: true })
        try {
          image.src = sourceUrl
        } catch {
          fail()
        }
      }
    )
    signal.throwIfAborted()
    return metadata
  } finally {
    image.onload = null
    image.onerror = null
    if (typeof source !== 'string') URL.revokeObjectURL(sourceUrl)
  }
}

export async function readWorkshopVideoMetadata(
  source: File | string,
  signal: AbortSignal
): Promise<WorkshopVideoMetadata> {
  signal.throwIfAborted()
  const video = document.createElement('video')
  const sourceUrl =
    typeof source === 'string' ? source : URL.createObjectURL(source)
  video.preload = 'metadata'

  try {
    const metadata = await new Promise<WorkshopVideoMetadata>(
      (resolve, reject) => {
        const abort = () => finish(undefined, signal.reason)
        const fail = () =>
          finish(
            undefined,
            new DOMException(
              'Video metadata could not be read',
              'NotSupportedError'
            )
          )
        const timer = setTimeout(
          () =>
            finish(
              undefined,
              new DOMException('Video metadata timed out', 'TimeoutError')
            ),
          15_000
        )

        function finish(value?: WorkshopVideoMetadata, error?: unknown) {
          clearTimeout(timer)
          signal.removeEventListener('abort', abort)
          video.onloadedmetadata = null
          video.onerror = null
          if (value === undefined) reject(error)
          else resolve(value)
        }

        video.onloadedmetadata = () => {
          const value = {
            durationSeconds: video.duration,
            widthPixels: video.videoWidth,
            heightPixels: video.videoHeight
          }
          if (
            Object.values(value).every(
              (measurement) => Number.isFinite(measurement) && measurement > 0
            )
          )
            finish(value)
          else fail()
        }
        video.onerror = fail
        signal.addEventListener('abort', abort, { once: true })
        try {
          video.src = sourceUrl
        } catch {
          fail()
        }
      }
    )
    signal.throwIfAborted()
    return metadata
  } finally {
    video.removeAttribute('src')
    video.load()
    if (typeof source !== 'string') URL.revokeObjectURL(sourceUrl)
  }
}
