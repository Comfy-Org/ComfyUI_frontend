import { mockRenderJob } from '../mock-job'
import type { CutoutMode, CutoutRequest, CutoutResult } from './contract'
import { renderCutout } from './render-cutout'

/** Draws a request's result image, as an object URL, or undefined. */
export type CutoutRender = (
  request: CutoutRequest
) => Promise<string | undefined>

export const CUTOUT_CREDITS = {
  remove: 4,
  replace: 10,
  adjust: 4
} as const satisfies Record<CutoutMode, number>

/** How long the mock takes to answer, which its progress counts towards. */
export const CUTOUT_RUN_MS = 2200

/**
 * Stands in for the Background Removal backend until it exists: waits, then
 * answers with the result drawn in the browser (`render`), or the photo
 * itself where that cannot draw. Replace this with the real job call; the
 * page only needs the same request and result shapes.
 */
export async function runCutout(
  request: CutoutRequest,
  signal: AbortSignal,
  render: CutoutRender = renderCutout
): Promise<CutoutResult> {
  const url = await mockRenderJob(() => render(request), signal, CUTOUT_RUN_MS)
  return {
    url: url ?? request.imageUrl,
    mode: request.mode,
    format: request.format,
    transparent:
      Boolean(url) &&
      request.mode === 'remove' &&
      request.background.kind === 'transparent'
  }
}
