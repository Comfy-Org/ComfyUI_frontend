export const SWAP_RESOLUTIONS = ['1K', '2K', '4K'] as const
export type SwapResolution = (typeof SWAP_RESOLUTIONS)[number]

/**
 * What the Hand product swap backend receives for one run, one key per
 * multipart field of `POST /api/run/hand-product-swap`. The model finds what
 * the hand holds by itself and keeps the same hand and grip, so there is no
 * placement to send.
 */
export interface HandSwapRequest {
  /** The photo of a hand holding something. */
  readonly hand: string
  /** The product that takes the place of what the hand holds. */
  readonly product: string
  /** The output's long edge. */
  readonly resolution: SwapResolution
  readonly seed: number
}

/** How far along a run is, as the backend reports it. */
export type SwapProgress =
  | { readonly kind: 'queued' }
  | { readonly kind: 'running'; readonly percent: number }

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
