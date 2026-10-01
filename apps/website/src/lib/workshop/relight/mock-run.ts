import { mockJob } from '../mock-job'
import type { Light, RelightScene } from './lights'
import { lightHex } from './lights'

export interface RelightRequest {
  readonly imageUrl: string
  readonly lights: readonly (Omit<Light, 'color'> & {
    readonly color: string
  })[]
  readonly scene: RelightScene
}

export interface RelightResult {
  readonly url: string
  readonly seed: number
}

export const RELIGHT_CREDITS = 20

const EXAMPLE = '/images/apps/relight/example.jpg'
const EXAMPLE_RELIT = '/images/apps/relight/example-relit.jpg'
const MOCK_DELAY_MS = 2400

export const RELIGHT_EXAMPLE = {
  url: EXAMPLE,
  name: 'portrait.jpg',
  width: 640,
  height: 400
} as const

/** The request for a photo, its lights (colors as hex) and its scene. */
export function relightRequest(
  imageUrl: string,
  lights: readonly Light[],
  scene: RelightScene
): RelightRequest {
  return {
    imageUrl,
    lights: lights.map((light) => ({ ...light, color: lightHex(light.color) })),
    scene
  }
}

/**
 * Stands in for the Relight backend until it exists: waits, then answers
 * with the worked example's relit photo, or the visitor's own photo.
 * Replace this with the real job call; the page only needs the same
 * request and result shapes.
 */
export function runRelight(
  request: RelightRequest,
  signal: AbortSignal
): Promise<RelightResult> {
  const url = request.imageUrl === EXAMPLE ? EXAMPLE_RELIT : request.imageUrl
  return mockJob({ url, seed: 7 }, signal, MOCK_DELAY_MS)
}
