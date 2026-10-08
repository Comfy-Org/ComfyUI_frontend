import type { TrimLimits } from '@/lib/workshop/video-trim/range'

/** MiniMax H3 reads and writes 24 frames a second, in lengths of 17k + 5 frames. */
export const FPS = 24
const GRID_STEP = 17
const GRID_OFFSET = 5

/** The part of a video H3 can take: 5 to 15 seconds. */
export const SWAP_TRIM_LIMITS: TrimLimits = { min: 5, max: 15 }

/** The longest run: 345 frames (14.4 s). The next grid length passes 15 s. */
const MAX_FRAMES = 345

/**
 * The most frames H3's grid fits into `seconds` of source at 24 fps. The run
 * is a little shorter than the part chosen, never longer than it.
 */
export function gridFrames(seconds: number): number {
  const available = Math.floor(seconds * FPS + 1e-6)
  const spare = (available - GRID_OFFSET) % GRID_STEP
  return Math.min(MAX_FRAMES, available - Math.max(0, spare))
}

/** The part of the clip a swap runs on. */
export interface SwapWindow {
  /** Seconds into the clip. */
  readonly start: number
  /** Seconds chosen; the run uses `gridFrames` of it. */
  readonly seconds: number
}

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
