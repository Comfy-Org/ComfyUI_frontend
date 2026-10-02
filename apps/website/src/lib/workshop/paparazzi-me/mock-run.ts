import { mockJob } from '../mock-job'
import type { PaparazziRequest, PaparazziResult } from './contract'
import { lookUp, placeOfToken } from './mock-search'
import type { FaceCrop } from './render'
import { renderPaparazziImage } from './render'
import { DEFAULT_SETUP } from './setup'

/** Draws a stand-in result as an object URL, or undefined. */
export type PaparazziRender = typeof renderPaparazziImage

export const PAPARAZZI_CREDITS = 10
export const PAPARAZZI_RUN_MS = 2400

const EXAMPLE_RESULT = '/images/apps/paparazzi-me/example-result.jpg'

export const PAPARAZZI_EXAMPLE = {
  url: '/images/cinematic-studio/options/shot-close.jpg',
  name: 'my-face.jpg',
  width: 1280,
  height: 720,
  /** Where her head sits, for the mock composite. */
  crop: { cx: 0.6, cy: 0.36, size: 0.66 }
} as const

/** The example's own scene: the example star on the red carpet. */
export const EXAMPLE_SCENE_TOKEN = lookUp(DEFAULT_SETUP.celebrity).candidates[0]
  .token

/** A visitor's own photo is assumed to be a centred portrait. */
const PORTRAIT_CROP: FaceCrop = { cx: 0.5, cy: 0.4, size: 0.62 }

function faceCrop(url: string): FaceCrop {
  return url === PAPARAZZI_EXAMPLE.url ? PAPARAZZI_EXAMPLE.crop : PORTRAIT_CROP
}

function isExample(request: PaparazziRequest): boolean {
  return (
    request.user === PAPARAZZI_EXAMPLE.url &&
    request.celebrity === DEFAULT_SETUP.celebrity &&
    request.sceneToken === EXAMPLE_SCENE_TOKEN &&
    !request.scene
  )
}

/** The scene photo a request points at, and where the visitor stands in it. */
function sceneOf(request: PaparazziRequest) {
  if (request.scene) return { url: request.scene, you: 0.3 }
  const place = request.sceneToken
    ? placeOfToken(request.sceneToken)
    : undefined
  return place ?? lookUp(request.celebrity).candidates[0].place
}

/**
 * Stands in for `POST /api/run/paparazzi-me` until it exists: waits, then
 * answers the prepared photo for the worked example, or the face stood in
 * the scene photo (`render`), or, where that cannot draw, the scene itself.
 * Replace this with the real job call; the page only needs the same request
 * and result shapes.
 */
export async function runPaparazzi(
  request: PaparazziRequest,
  signal: AbortSignal,
  render: PaparazziRender = renderPaparazziImage
): Promise<PaparazziResult> {
  const scene = sceneOf(request)
  const rendered = isExample(request)
    ? undefined
    : render(
        scene,
        request.user,
        faceCrop(request.user),
        request.resolution
      ).catch(() => undefined)
  try {
    await mockJob(undefined, signal, PAPARAZZI_RUN_MS)
  } catch (error) {
    void rendered?.then((url) => url && URL.revokeObjectURL(url))
    throw error
  }
  const url = rendered ? ((await rendered) ?? scene.url) : EXAMPLE_RESULT
  return { url, seed: request.seed }
}
