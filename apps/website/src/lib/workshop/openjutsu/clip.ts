/** MiniMax H3 reads and writes 24 frames a second, in lengths of 17k + 5 frames. */
export const FPS = 24
const GRID_STEP = 17
const GRID_OFFSET = 5

/** The clip lengths a visitor may upload, in seconds. */
const MIN_CLIP_SECONDS = 5
const MAX_CLIP_SECONDS = 15
/** A container rounds its length; a "5 second" file often reads 4.97. */
const LENGTH_TOLERANCE = 0.05

/** The shortest swap: 73 frames, the length the LoRA's own training clips had. */
const MIN_FRAMES = 73
/** The longest: 345 frames (14.4 s). The next grid length passes H3's 15 s. */
const MAX_FRAMES = 345

export const MIN_WINDOW_SECONDS = MIN_FRAMES / FPS
/** Short, continuous shots are where the LoRA holds up best. */
const DEFAULT_WINDOW_SECONDS = 5

export function clipFits(seconds: number): boolean {
  return (
    seconds >= MIN_CLIP_SECONDS - LENGTH_TOLERANCE &&
    seconds <= MAX_CLIP_SECONDS + LENGTH_TOLERANCE
  )
}

/** The most frames H3's grid fits into `seconds` of source at 24 fps. */
export function gridFrames(seconds: number): number {
  const available = Math.floor(seconds * FPS + 1e-6)
  const fitted =
    available -
    ((((available - GRID_OFFSET) % GRID_STEP) + GRID_STEP) % GRID_STEP)
  return Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, fitted))
}

/** The part of the clip a swap runs on. */
export interface SwapWindow {
  /** Seconds into the clip. */
  readonly start: number
  /** Seconds asked for; the run uses `gridFrames` of it. */
  readonly seconds: number
}

/** The longest window a clip of this length allows. */
export const maxWindowSeconds = (clipSeconds: number) =>
  Math.min(clipSeconds, MAX_FRAMES / FPS)

/** One grid step, in seconds: the least a swap can grow or shrink by. */
export const WINDOW_STEP_SECONDS = GRID_STEP / FPS

/**
 * A window moved and resized until it lies inside the clip, its length the
 * nearest one H3's grid allows, so what is shown is what will run.
 */
export function fitWindow(window: SwapWindow, clipSeconds: number): SwapWindow {
  const steps = Math.round((window.seconds * FPS - GRID_OFFSET) / GRID_STEP)
  const frames = Math.min(
    gridFrames(maxWindowSeconds(clipSeconds)),
    Math.max(MIN_FRAMES, steps * GRID_STEP + GRID_OFFSET)
  )
  const seconds = frames / FPS
  const start = Math.min(
    Math.max(0, clipSeconds - seconds),
    Math.max(0, window.start)
  )
  return { start, seconds }
}

export const defaultWindow = (clipSeconds: number): SwapWindow =>
  fitWindow({ start: 0, seconds: DEFAULT_WINDOW_SECONDS }, clipSeconds)

export interface SwapCanvas {
  readonly width: number
  readonly height: number
}

/**
 * One canvas per aspect family at the LoRA's own 768 short edge (its training
 * bucket is 1344x768). Each side is a multiple of 32, as H3 needs.
 */
const CANVASES: readonly SwapCanvas[] = [
  { width: 1344, height: 768 },
  { width: 768, height: 1344 },
  { width: 768, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 1536, height: 672 }
]

/** The canvas closest in shape to the source, so the shot is not recomposed. */
export function pickCanvas(width: number, height: number): SwapCanvas {
  const ratio = Math.log(width / height)
  return CANVASES.reduce((best, canvas) =>
    Math.abs(Math.log(canvas.width / canvas.height) - ratio) <
    Math.abs(Math.log(best.width / best.height) - ratio)
      ? canvas
      : best
  )
}

export interface ClipFacts {
  readonly seconds: number
  readonly width: number
  readonly height: number
}

/** A video's length and frame size from its metadata; undefined if unreadable. */
export function clipFactsOf(url: string): Promise<ClipFacts | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () =>
      resolve(
        Number.isFinite(video.duration) && video.videoWidth > 0
          ? {
              seconds: video.duration,
              width: video.videoWidth,
              height: video.videoHeight
            }
          : undefined
      )
    video.onerror = () => resolve(undefined)
    video.src = url
  })
}
