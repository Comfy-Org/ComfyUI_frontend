import { mockRenderJob } from '../mock-job'
import type { CutoutRequest, CutoutResult } from './contract'
import { renderCutout } from './render-cutout'

/** Draws a request's result image, as an object URL, or undefined. */
export type CutoutRender = (
  request: CutoutRequest
) => Promise<string | undefined>

export const CUTOUT_CREDITS = 4

const MOCK_DELAY_MS = 2200

/**
 * Stands in for the Background Removal backend until it exists: waits, then
 * answers with the cutout drawn in the browser (`render`), or the photo
 * itself where that cannot draw. Replace this with the real job call; the
 * page only needs the same request and result shapes.
 */
export async function runCutout(
  request: CutoutRequest,
  signal: AbortSignal,
  render: CutoutRender = renderCutout
): Promise<CutoutResult> {
  const url = await mockRenderJob(() => render(request), signal, MOCK_DELAY_MS)
  return {
    url: url ?? request.imageUrl,
    background: request.background,
    format: request.format,
    seed: request.seed
  }
}
