import {
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'
import { reportError } from '@/platform/telemetry/reportError'

let queue: Promise<unknown> = Promise.resolve()
const MODEL_THUMBNAIL_TIMEOUT_MS = 10_000

/**
 * Outcome of an offscreen thumbnail render. `timed-out` is the only
 * failure worth retrying: the model may simply have been slower than the
 * deadline, whereas `failed` means it could not be rendered at all.
 */
export type ModelThumbnailResult =
  | { status: 'rendered'; dataUrl: string }
  | { status: 'timed-out' }
  | { status: 'cancelled' }
  | { status: 'failed' }

/**
 * Render a model to a thumbnail data URL offscreen, without opening the
 * viewer. Runs one generation at a time to bound live WebGL contexts and
 * persists the result through the asset API so other surfaces pick it up.
 * Aborting `callerSignal` settles the request and releases the queue, both
 * while it waits its turn and once it is running.
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

  try {
    const dataUrl = await Promise.race([
      renderThumbnail(modelUrl, assetName, abortController.signal),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort(timeoutError)
          reject(timeoutError)
        }, MODEL_THUMBNAIL_TIMEOUT_MS)
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
    if (error === timeoutError) {
      reportError(error, {
        errorType: 'agent_model_thumbnail_generation_failure'
      })
      return { status: 'timed-out' }
    }
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
