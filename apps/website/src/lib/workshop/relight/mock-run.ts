import { mockJob } from '../mock-job'
import type {
  Light,
  RelightGeneration,
  RelightMask,
  RelightMaskArea,
  RelightScene
} from './lights'
import { renderRelitImage } from './render-image'

export interface RelightRequest {
  readonly imageUrl: string
  readonly lights: readonly Light[]
  readonly masks: readonly RelightMaskArea[]
  readonly scene: RelightScene
  readonly generation: RelightGeneration
}

export interface RelightResult {
  readonly url: string
  readonly seed: number
}

/** Draws a request's result image, as an object URL, or undefined. */
export type RelightRender = (
  request: RelightRequest
) => Promise<string | undefined>

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

/** The request for a photo, its lights, masks, scene and generation. */
export function relightRequest(
  imageUrl: string,
  lights: readonly Light[],
  masks: readonly RelightMask[],
  scene: RelightScene,
  generation: RelightGeneration
): RelightRequest {
  return {
    imageUrl,
    lights,
    masks: masks.map(({ visible: _shown, ...area }) => area),
    scene,
    generation
  }
}

/**
 * Stands in for the Relight backend until it exists: waits, then answers
 * with the request's lights rendered over the photo (`render`), or, where
 * that cannot draw, the worked example's relit photo or the photo itself.
 * Replace this with the real job call; the page only needs the same
 * request and result shapes.
 */
export async function runRelight(
  request: RelightRequest,
  signal: AbortSignal,
  render: RelightRender = renderRelitImage
): Promise<RelightResult> {
  const rendered = render(request).catch(() => undefined)
  try {
    await mockJob(undefined, signal, MOCK_DELAY_MS)
  } catch (error) {
    void rendered.then((url) => url && URL.revokeObjectURL(url))
    throw error
  }
  const url =
    (await rendered) ??
    (request.imageUrl === EXAMPLE ? EXAMPLE_RELIT : request.imageUrl)
  return { url, seed: request.generation.seed }
}
