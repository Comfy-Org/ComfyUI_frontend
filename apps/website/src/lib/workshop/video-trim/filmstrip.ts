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

/** What a loaded video element reports; undefined if it is not a usable video. */
export function factsOf(video: {
  readonly duration: number
  readonly videoWidth: number
  readonly videoHeight: number
}): VideoFacts | undefined {
  const usable =
    Number.isFinite(video.duration) &&
    video.duration > 0 &&
    video.videoWidth > 0
  return usable
    ? {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      }
    : undefined
}

/** The moment each tile shows: the middle of its share of the video, never its very end. */
export const tileTimes = (count: number, duration: number): number[] =>
  Array.from(
    { length: count },
    (_, index) => ((index + 0.5) / count) * duration
  )

/** A tile's pixels: a fixed height, as wide as the video's shape makes it. */
export const tileSize = (facts: VideoFacts) => ({
  width: Math.max(1, Math.round((TILE_HEIGHT * facts.width) / facts.height)),
  height: TILE_HEIGHT
})

function release(video: HTMLVideoElement) {
  video.removeAttribute('src')
  video.load()
}

/** Waits until the element has reached `state`, or gives up. */
const reached = async (
  video: HTMLVideoElement,
  state: number,
  event: string,
  signal: AbortSignal
) => video.readyState >= state || (await once(video, event, signal))

/** A video's length and frame size; undefined if the browser cannot read it. */
export async function readVideoFacts(
  url: string,
  signal: AbortSignal
): Promise<VideoFacts | undefined> {
  const video = detached(url)
  try {
    const loaded = await reached(video, 1, 'loadedmetadata', signal)
    return loaded ? factsOf(video) : undefined
  } finally {
    release(video)
  }
}

/** The canvas to draw stills on, once the video has a frame to give. */
async function drawable(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  signal: AbortSignal
): Promise<CanvasRenderingContext2D | undefined> {
  const context = canvas.getContext('2d')
  if (!context) return undefined
  return (await reached(video, 2, 'loadeddata', signal)) ? context : undefined
}

/** One still at `time`, or nothing if the video would not go there. */
async function captureTile(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  time: number,
  signal: AbortSignal
): Promise<string | undefined> {
  if (signal.aborted) return undefined
  video.currentTime = time
  if (!(await once(video, 'seeked', signal))) return undefined
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.6)
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
  const canvas = Object.assign(
    document.createElement('canvas'),
    tileSize(facts)
  )
  try {
    const context = await drawable(video, canvas, signal)
    if (!context) return
    for (const [index, time] of tileTimes(count, facts.duration).entries()) {
      const image = await captureTile(video, canvas, context, time, signal)
      if (image) onTile(index, image)
    }
  } finally {
    release(video)
  }
}
