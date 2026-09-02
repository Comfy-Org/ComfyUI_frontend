import {
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'
import { reportError } from '@/platform/telemetry/reportError'

let queue: Promise<unknown> = Promise.resolve()
const MODEL_THUMBNAIL_TIMEOUT_MS = 10_000

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
 * The viewer chunk and the model each get their own deadline, so a cold
 * code-split fetch is bounded without spending the model's budget. A
 * render that outlives its deadline is given up on: its viewer is torn
 * down and the queue moves on, but the underlying transfer and parse are
 * not abortable and run to completion in the background. Aborting
 * `callerSignal` gives up the same way, and skips the render entirely if
 * it has not started yet.
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
  const timeoutError = new Error('Model thumbnail generation timed out')
  const cancelError = new Error('Model thumbnail generation cancelled')
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let onCallerAbort: (() => void) | undefined
  let expire: (error: Error) => void = () => {}

  const restartDeadline = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      abortController.abort(timeoutError)
      expire(timeoutError)
    }, MODEL_THUMBNAIL_TIMEOUT_MS)
  }

  try {
    const dataUrl = await Promise.race([
      renderThumbnail(
        modelUrl,
        assetName,
        abortController.signal,
        restartDeadline
      ),
      new Promise<never>((_, reject) => {
        expire = reject
        restartDeadline()
      }),
      new Promise<never>((_, reject) => {
        onCallerAbort = () => {
          abortController.abort(cancelError)
          reject(cancelError)
        }
        callerSignal?.addEventListener('abort', onCallerAbort, { once: true })
      })
    ])
    return { status: 'rendered', dataUrl }
  } catch (error) {
    if (callerSignal?.aborted) return { status: 'cancelled' }
    reportError(error, {
      errorType: 'agent_model_thumbnail_generation_failure'
    })
    return { status: 'failed' }
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    if (onCallerAbort) callerSignal?.removeEventListener('abort', onCallerAbort)
  }
}

async function renderThumbnail(
  modelUrl: string,
  assetName: string,
  signal: AbortSignal,
  restartDeadline: () => void
): Promise<string> {
  const { createLoad3d } = await import('@/extensions/core/load3d/createLoad3d')
  signal.throwIfAborted()
  restartDeadline()

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
    await load3d.loadModel(modelUrl, undefined, { silent: true })
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
