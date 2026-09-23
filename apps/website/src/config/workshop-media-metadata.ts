export async function readWorkshopVideoDuration(
  source: File | string,
  signal: AbortSignal
): Promise<number> {
  signal.throwIfAborted()
  const video = document.createElement('video')
  const sourceUrl =
    typeof source === 'string' ? source : URL.createObjectURL(source)
  video.preload = 'metadata'

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const abort = () => finish(undefined, signal.reason)
      const fail = () =>
        finish(
          undefined,
          new DOMException(
            'Video duration could not be read',
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

      function finish(seconds?: number, error?: unknown) {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        video.onloadedmetadata = null
        video.onerror = null
        if (seconds === undefined) reject(error)
        else resolve(seconds)
      }

      video.onloadedmetadata = () => {
        const seconds = video.duration
        if (Number.isFinite(seconds) && seconds > 0) finish(seconds)
        else fail()
      }
      video.onerror = fail
      signal.addEventListener('abort', abort, { once: true })
      try {
        video.src = sourceUrl
      } catch {
        fail()
      }
    })
    signal.throwIfAborted()
    return duration
  } finally {
    video.removeAttribute('src')
    video.load()
    if (typeof source !== 'string') URL.revokeObjectURL(sourceUrl)
  }
}
