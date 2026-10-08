import type { TrimLimits } from '@/lib/workshop/video-trim/range'

/** MiniMax H3 reads and writes 24 frames a second, in lengths of 17k + 5 frames. */
const FPS = 24
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

/** The two qualities on offer; the first is the default. */
export const SWAP_SIZES = ['768p', '480p'] as const
export type SwapSize = (typeof SWAP_SIZES)[number]

/**
 * The pixels each quality generates: the LoRA's own training bucket
 * (1344x768) and its author's starting resolution (864x480).
 */
const PIXELS: Readonly<Record<SwapSize, number>> = {
  '768p': 1344 * 768,
  '480p': 864 * 480
}

/** H3 generates on sides that are multiples of 32. */
const SIDE_STEP = 32
const snap = (side: number) =>
  Math.max(SIDE_STEP, Math.round(side / SIDE_STEP) * SIDE_STEP)
const even = (side: number) => Math.max(2, Math.round(side / 2) * 2)

/**
 * The canvas H3 generates on: the source's own shape at the quality's pixel
 * count, each side moved to the nearest multiple of 32. That nudges the shape
 * by a few percent at most; `resultSize` takes the nudge back out.
 */
export function swapCanvas(
  width: number,
  height: number,
  size: SwapSize
): SwapCanvas {
  const ratio = width / height
  return {
    width: snap(Math.sqrt(PIXELS[size] * ratio)),
    height: snap(Math.sqrt(PIXELS[size] / ratio))
  }
}

/**
 * The size the result is saved at: the largest frame of exactly the source's
 * shape that fits inside the canvas, so a swap never changes aspect ratio.
 */
export function resultSize(
  width: number,
  height: number,
  canvas: SwapCanvas
): SwapCanvas {
  const scale = Math.min(canvas.width / width, canvas.height / height)
  return { width: even(width * scale), height: even(height * scale) }
}
