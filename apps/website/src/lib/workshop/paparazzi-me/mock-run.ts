import { mockJob } from '../mock-job'
import type { PaparazziRequest, PaparazziResult } from './contract'
import type { FaceCrop } from './draw-figures'
import { renderPaparazziImage } from './render'
import { DEFAULT_SETUP } from './setup'

/** Draws a request's result image, as an object URL, or undefined. */
export type PaparazziRender = (
  request: PaparazziRequest,
  crop: FaceCrop
) => Promise<string | undefined>

export const PAPARAZZI_CREDITS = 10

const EXAMPLE_RESULT = '/images/apps/paparazzi-me/example-result.jpg'
const MOCK_DELAY_MS = 2400

export const PAPARAZZI_EXAMPLE = {
  url: '/images/cinematic-studio/options/shot-close.jpg',
  name: 'my-face.jpg',
  width: 1280,
  height: 720,
  /** Where her head sits, for the face card and the mock composite. */
  crop: { cx: 0.6, cy: 0.36, size: 0.66 }
} as const

/** A visitor's own photo is assumed to be a centred portrait. */
const PORTRAIT_CROP: FaceCrop = { cx: 0.5, cy: 0.4, size: 0.62 }

export function faceCrop(url: string): FaceCrop {
  return url === PAPARAZZI_EXAMPLE.url ? PAPARAZZI_EXAMPLE.crop : PORTRAIT_CROP
}

/** The example photo for the example face with the example star in a preset scene. */
function preparedResult(request: PaparazziRequest): string | undefined {
  if (
    request.faceUrl !== PAPARAZZI_EXAMPLE.url ||
    request.celebrity !== DEFAULT_SETUP.celebrity ||
    request.scene === 'custom'
  )
    return undefined
  return `/images/apps/paparazzi-me/result-${request.scene}.jpg`
}

/**
 * Stands in for the Paparazzi me backend until it exists: waits, then
 * answers with the example photo for the example (`preparedResult`), or the
 * visitor's face composited into a flash-lit scene (`render`), or, where
 * that cannot draw, the worked example's photo or the face itself. Replace this with the real job call; the page only needs the
 * same request and result shapes.
 */
export async function runPaparazzi(
  request: PaparazziRequest,
  signal: AbortSignal,
  render: PaparazziRender = renderPaparazziImage
): Promise<PaparazziResult> {
  const prepared = preparedResult(request)
  const rendered = prepared
    ? undefined
    : render(request, faceCrop(request.faceUrl)).catch(() => undefined)
  try {
    await mockJob(undefined, signal, MOCK_DELAY_MS)
  } catch (error) {
    void rendered?.then((url) => url && URL.revokeObjectURL(url))
    throw error
  }
  const url =
    prepared ??
    (await rendered) ??
    (request.faceUrl === PAPARAZZI_EXAMPLE.url
      ? EXAMPLE_RESULT
      : request.faceUrl)
  return { url, seed: request.seed }
}
