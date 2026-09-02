import { withTimeout } from 'es-toolkit'

import {
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'
import { reportError } from '@/platform/telemetry/reportError'

let queue: Promise<unknown> = Promise.resolve()
const MODEL_LOAD_TIMEOUT_MS = 15_000

/**
 * Outcome of an offscreen thumbnail render. `cancelled` is separated from
 * `failed` so a caller that walked away is not reported as a fault.
 */
export type ModelThumbnailResult =
  | { status: 'rendered'; dataUrl: string }
  | { status: 'cancelled' }
  | { status: 'failed' }

/**
 * Render a model to a thumbnail data URL offscreen, without opening the
 * viewer. Starts one render at a time so at most one offscreen scene is
 * live, and persists the result through the asset API so other surfaces
 * pick it up.
 *
 * The model load is bounded by `withTimeout` (see #16485) so a stuck load
 * cannot block the queue forever; a render that outlives its deadline is
 * given up on — its viewer is torn down and the queue moves on — but the
 * underlying transfer and parse are not abortable and run to completion
 * in the background. Aborting `callerSignal` gives up the same way, and
 * skips the render entirely if it has not started yet.
 */
export function generateModelThumbnail(
  modelUrl: string,
  assetName: string,
  callerSignal?: AbortSignal
): Promise<ModelThumbnailResult> {
  const run = queue.then(
    (): ModelThumbnailResult | Promise<ModelThumbnailResult> =>
      callerSignal?.aborted
        ? { status: 'cancelled' }
        : renderThumbnailWithTimeout(modelUrl, assetName, callerSignal)
  )
  queue = run.catch(() => null)
  return run
}

async function renderThumbnailWithTimeout(
  modelUrl: string,
  assetName: string,
  callerSignal?: AbortSignal
): Promise<ModelThumbnailResult> {
  const abortController = new AbortController()
  const cancelError = new Error('Model thumbnail generation cancelled')
  let onCallerAbort: (() => void) | undefined

  const renderPromise = renderThumbnail(
    modelUrl,
    assetName,
    abortController.signal
  )

  try {
    const dataUrl = await (callerSignal
      ? Promise.race([
          renderPromise,
          new Promise<never>((_, reject) => {
            onCallerAbort = () => {
              abortController.abort(cancelError)
              reject(cancelError)
            }
            callerSignal.addEventListener('abort', onCallerAbort, {
              once: true
            })
          })
        ])
      : renderPromise)
    return { status: 'rendered', dataUrl }
  } catch (error) {
    // Classify on the sentinel, not on `callerSignal.aborted`: an abort
    // observed after a deadline or render fault has already rejected would
    // otherwise relabel a real failure as a user cancellation.
    if (error === cancelError) return { status: 'cancelled' }
    reportError(redactModelUrls(error), {
      errorType: 'agent_model_thumbnail_generation_failure',
      context: { assetName: redactAssetName(assetName) }
    })
    return { status: 'failed' }
  } finally {
    if (onCallerAbort) callerSignal?.removeEventListener('abort', onCallerAbort)
    // Swallow late rejection from the abandoned background render so an
    // abort/timeout never surfaces as an unhandled rejection.
    renderPromise.catch(() => {})
  }
}

/**
 * three.js embeds the failed request URL in its loader errors, and the
 * agent path derives both that URL and the asset name from the model's
 * markdown reply, so either may carry credentials or signed parameters.
 * Strip them before anything reaches Sentry or Datadog.
 */
function redactUrls(text: string): string {
  return text
    .replace(/(https?:\/\/)[^/\s"']*@/g, '$1<redacted>@')
    .replace(/(https?:\/\/[^\s"'?]+|\/?api\/view)\?[^\s"']*/g, '$1?<redacted>')
}

function redactAssetName(assetName: string): string {
  return assetName.replace(/[?#].*$/, '')
}

function redactModelUrls(error: unknown): Error {
  if (!(error instanceof Error)) return new Error(redactUrls(String(error)))

  const message = redactUrls(error.message)
  const stack = error.stack ? redactUrls(error.stack) : undefined
  if (message === error.message && stack === error.stack) return error

  const copy = new Error(message)
  copy.name = error.name
  if (stack) copy.stack = stack
  return copy
}

async function renderThumbnail(
  modelUrl: string,
  assetName: string,
  signal: AbortSignal
): Promise<string> {
  const { createLoad3d } = await import('@/extensions/core/load3d/createLoad3d')
  signal.throwIfAborted()

  const load3d = createLoad3d(document.createElement('div'), {
    width: 256,
    height: 256,
    isViewerMode: true
  })
  let removed = false
  const remove = () => {
    if (!removed) {
      removed = true
      load3d.remove()
    }
  }
  signal.addEventListener('abort', remove, { once: true })

  try {
    await withTimeout(
      () => load3d.loadModel(modelUrl, undefined, { silent: true }),
      MODEL_LOAD_TIMEOUT_MS
    )
    signal.throwIfAborted()
    const dataUrl = await load3d.captureThumbnail(256, 256)
    signal.throwIfAborted()
    if (isAssetPreviewSupported()) {
      void fetch(dataUrl)
        .then((response) => response.blob())
        .then((blob) => persistThumbnail(assetName, blob))
        .catch(() => {})
    }
    return dataUrl
  } finally {
    signal.removeEventListener('abort', remove)
    remove()
  }
}
