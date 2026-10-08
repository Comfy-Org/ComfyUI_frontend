/** What a browser can read of a video before anything is uploaded. */
export interface VideoFacts {
  /** Seconds. */
  readonly duration: number
  readonly width: number
  readonly height: number
}

const EVENT_TIMEOUT_MS = 8_000
const TILE_HEIGHT = 96

function once(
  video: HTMLVideoElement,
  event: string,
  signal: AbortSignal
): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer)
      video.removeEventListener(event, succeed)
      video.removeEventListener('error', fail)
      signal.removeEventListener('abort', fail)
      resolve(ok)
    }
    const succeed = () => finish(true)
    const fail = () => finish(false)
    const timer = setTimeout(fail, EVENT_TIMEOUT_MS)
    video.addEventListener(event, succeed, { once: true })
    video.addEventListener('error', fail, { once: true })
    signal.addEventListener('abort', fail, { once: true })
  })
}

function detached(url: string): HTMLVideoElement {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  return video
}

/** A video's length and frame size; undefined if the browser cannot read it. */
export async function readVideoFacts(
  url: string,
  signal: AbortSignal
): Promise<VideoFacts | undefined> {
  const video = detached(url)
  try {
    if (video.readyState < 1 && !(await once(video, 'loadedmetadata', signal)))
      return undefined
    return Number.isFinite(video.duration) &&
      video.duration > 0 &&
      video.videoWidth > 0
      ? {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        }
      : undefined
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}

/**
 * Small stills spread evenly across the whole video, in order, for a
 * timeline to lay side by side. `onTile` is called as each one is ready, so
 * the strip fills in from the left; a frame that cannot be drawn is skipped.
 */
export async function captureFilmstrip(
  url: string,
  facts: VideoFacts,
  count: number,
  onTile: (index: number, image: string) => void,
  signal: AbortSignal
): Promise<void> {
  const video = detached(url)
  const canvas = document.createElement('canvas')
  canvas.height = TILE_HEIGHT
  canvas.width = Math.max(
    1,
    Math.round((TILE_HEIGHT * facts.width) / facts.height)
  )
  const context = canvas.getContext('2d')
  try {
    if (!context) return
    if (video.readyState < 2 && !(await once(video, 'loadeddata', signal)))
      return
    for (let index = 0; index < count && !signal.aborted; index++) {
      // the middle of each tile's share of the video, never its very end
      video.currentTime = ((index + 0.5) / count) * facts.duration
      if (!(await once(video, 'seeked', signal))) continue
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      onTile(index, canvas.toDataURL('image/jpeg', 0.6))
    }
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}
