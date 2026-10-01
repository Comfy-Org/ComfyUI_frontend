import { mockJob } from '../mock-job'
import type { HandSwapRequest, HandSwapResult } from './contract'
import { renderSwapImage } from './render-swap'

/** Draws a request's result image, as an object URL, or undefined. */
type SwapRender = (request: HandSwapRequest) => Promise<string | undefined>

const MOCK_DELAY_MS = 2400

/**
 * Stands in for the Hand product swap backend until it exists: waits, then
 * answers with the product composited into the held region (`render`), or
 * the hand photo itself where that cannot draw. Replace this with the real
 * job call; the page only needs the same request and result shapes.
 */
export async function runHandSwap(
  request: HandSwapRequest,
  signal: AbortSignal,
  render: SwapRender = renderSwapImage
): Promise<HandSwapResult> {
  const rendered = render(request).catch(() => undefined)
  try {
    await mockJob(undefined, signal, MOCK_DELAY_MS)
  } catch (error) {
    void rendered.then((url) => url && URL.revokeObjectURL(url))
    throw error
  }
  return { url: (await rendered) ?? request.handImageUrl, seed: request.seed }
}
