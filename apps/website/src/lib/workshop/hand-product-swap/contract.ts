import type { Rect } from '../move-anything/arrange'

export const SWAP_RESOLUTIONS = ['1K', '2K', '4K'] as const
export type SwapResolution = (typeof SWAP_RESOLUTIONS)[number]

/** What the Hand product swap backend receives for one run. */
export interface HandSwapRequest {
  /** The photo of a hand holding something. */
  readonly handImageUrl: string
  /** The product that replaces what the hand holds. */
  readonly productImageUrl: string
  /** Where the held thing sits, each value a fraction of the hand photo. */
  readonly region: Rect
  readonly resolution: SwapResolution
  /** The output's size, its long edge set by `resolution`. */
  readonly width: number
  readonly height: number
  readonly seed: number
}

export interface HandSwapResult {
  readonly url: string
  readonly seed: number
}

const LONG_EDGE = {
  '1K': 1024,
  '2K': 2048,
  '4K': 4096
} as const satisfies Record<SwapResolution, number>

export const SWAP_CREDITS = {
  '1K': 14,
  '2K': 14,
  '4K': 25
} as const satisfies Record<SwapResolution, number>

/** The output size for a photo: its shape, the long edge set by `resolution`. */
export function outputSize(
  resolution: SwapResolution,
  width: number,
  height: number
): { width: number; height: number } {
  const edge = LONG_EDGE[resolution]
  const scale = edge / Math.max(width, height, 1)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

const round = (value: number) => Math.round(value * 10000) / 10000

/** The request for a hand photo, a product, where it goes and how big. */
export function swapRequest(input: {
  hand: { url: string; width: number; height: number }
  productUrl: string
  region: Rect
  resolution: SwapResolution
  seed: number
}): HandSwapRequest {
  const { hand, region, resolution } = input
  return {
    handImageUrl: hand.url,
    productImageUrl: input.productUrl,
    region: {
      x: round(region.x),
      y: round(region.y),
      w: round(region.w),
      h: round(region.h)
    },
    resolution,
    ...outputSize(resolution, hand.width, hand.height),
    seed: input.seed
  }
}
