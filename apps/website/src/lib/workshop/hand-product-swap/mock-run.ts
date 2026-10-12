import type { HandSwapRequest, HandSwapResult, SwapProgress } from './contract'
import { EXAMPLE_PRODUCTS, HAND_EXAMPLE } from './examples'
import { renderSwapImage } from './render-swap'

/** Draws a request's result image, as an object URL, or undefined. */
type SwapRender = (request: HandSwapRequest) => Promise<string | undefined>

const QUEUED_MS = 400
const RUNNING_MS = 2000
const TICK_MS = 200

/** The example photo of the hand holding an example product, if both are. */
function preparedResult({ hand, product }: HandSwapRequest) {
  if (hand !== HAND_EXAMPLE.url) return undefined
  return EXAMPLE_PRODUCTS.find(({ url }) => url === product)?.result
}

/** Reports queued, then a climbing percent, until done or aborted. */
function mockProgress(
  signal: AbortSignal,
  onProgress: (progress: SwapProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    onProgress({ kind: 'queued' })
    const timer = setInterval(() => {
      const running = Date.now() - startedAt - QUEUED_MS
      if (running >= RUNNING_MS) {
        clearInterval(timer)
        resolve()
      } else if (running >= 0) {
        onProgress({
          kind: 'running',
          percent: Math.round((running / RUNNING_MS) * 100)
        })
      }
    }, TICK_MS)
    signal.addEventListener('abort', () => {
      clearInterval(timer)
      reject(signal.reason)
    })
  })
}

/**
 * Stands in for the Hand product swap backend until it exists: reports its
 * progress, then answers with the example photo prepared for the example
 * hand and product, else the product composited into the hand photo
 * (`render`), or the hand photo itself where that cannot draw. Replace this
 * with the real job call; the page only needs the same request, progress
 * and result shapes.
 */
export async function runHandSwap(
  request: HandSwapRequest,
  signal: AbortSignal,
  onProgress: (progress: SwapProgress) => void = () => {},
  render: SwapRender = renderSwapImage
): Promise<HandSwapResult> {
  const prepared = preparedResult(request)
  const rendered = prepared
    ? Promise.resolve(undefined)
    : render(request).catch(() => undefined)
  try {
    await mockProgress(signal, onProgress)
  } catch (error) {
    void rendered.then((url) => url && URL.revokeObjectURL(url))
    throw error
  }
  return {
    url: prepared ?? (await rendered) ?? request.hand,
    seed: request.seed
  }
}
