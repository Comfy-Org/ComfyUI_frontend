import type { MoveObject } from './arrange'

export type MoveQuality = 'fast' | 'best'

export interface MoveRequest {
  readonly imageUrl: string
  readonly objects: readonly MoveObject[]
  readonly quality: MoveQuality
}

export interface MoveResult {
  readonly url: string
  readonly seed: number
}

export const MOVE_CREDITS = 12

const EXAMPLE = '/images/apps/move-anything/example.jpg'
const EXAMPLE_MOVED = '/images/apps/move-anything/example-moved.jpg'
const MOCK_DELAY_MS = 2400

/**
 * Stands in for the Move anything backend until it exists: waits, then
 * answers with the worked example's result, or the visitor's own photo.
 * Replace this with the real job call; the page only needs the same shape.
 */
export function runMove(
  request: MoveRequest,
  signal: AbortSignal
): Promise<MoveResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        resolve({
          url: request.imageUrl === EXAMPLE ? EXAMPLE_MOVED : request.imageUrl,
          seed: 42
        }),
      MOCK_DELAY_MS
    )
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}

export const MOVE_EXAMPLE = {
  url: EXAMPLE,
  name: 'kitten.jpg',
  width: 1043,
  height: 693
} as const
