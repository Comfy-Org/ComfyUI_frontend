import type { TrimLimits } from '@/lib/workshop/video-trim/range'

/** MiniMax H3 reads and writes 24 frames a second, in lengths of 17k + 5 frames. */
export const FPS = 24
const GRID_STEP = 17
const GRID_OFFSET = 5

/** The part of a video H3 can take: 5 to 15 seconds. */
export const SWAP_TRIM_LIMITS: TrimLimits = { min: 5, max: 15 }

/** The longest run: 345 frames (14.4 s). The next grid length passes 15 s. */
const MAX_FRAMES = 345

/** The seconds a swap gives back: the part chosen, up to H3's longest run. */
export const swapSeconds = (chosen: number) =>
  Math.min(chosen, MAX_FRAMES / FPS)

/** The frames of the chosen part at 24 fps: what H3 is shown of the source. */
export const sourceFrames = (chosen: number) =>
  Math.round(swapSeconds(chosen) * FPS)

/**
 * The frames H3 generates for a part: the next grid length at or above it,
 * as the LoRA's author sets it (5 s becomes 124 frames). The result is then
 * cut back to the part's own length.
 */
export function gridFrames(chosen: number): number {
  const needed = sourceFrames(chosen)
  const short = (GRID_OFFSET - needed) % GRID_STEP
  return Math.min(MAX_FRAMES, needed + ((short + GRID_STEP) % GRID_STEP))
}

/** The part of the clip a swap runs on. */
export interface SwapWindow {
  /** Seconds into the clip. */
  readonly start: number
  /** Seconds chosen; see `swapSeconds` for what comes back. */
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
