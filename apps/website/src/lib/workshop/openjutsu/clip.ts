import type { TrimLimits } from '@/lib/workshop/video-trim/range'

/** The part of a video a swap takes: 5 to 15 seconds. */
export const SWAP_TRIM_LIMITS: TrimLimits = { min: 5, max: 15 }

/** The seconds a swap gives back: the part chosen, up to the longest part. */
export const swapSeconds = (chosen: number) =>
  Math.min(chosen, SWAP_TRIM_LIMITS.max)

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
