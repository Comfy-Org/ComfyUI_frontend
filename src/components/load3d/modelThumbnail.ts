import { TimeoutError } from 'es-toolkit'

import {
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'
import { reportError } from '@/platform/telemetry/reportError'

let queue: Promise<unknown> = Promise.resolve()
const MODEL_LOAD_TIMEOUT_MS = 15_000

/**
 * `modelUrl` on the agent path is untrusted — it is the raw `href` from the
 * model's markdown reply and may carry credentials or a signed query string.
 * three.js's `FileLoader` embeds it verbatim in its thrown error, whose
 * message and stack both reach `reportError`, so absolute and root-relative
 * URL-shaped tokens are stripped of credentials and query strings here.
 */
function redactUrls(text: string): string {
  return text
    .replace(
      /https?:\/\/(?:[^\s"']*@)?[^\s"']+/g,
      (match) => match.replace(/^(https?:\/\/)[^@\s"']*@/, '$1').split('?')[0]
    )
    .replace(/(\/[^\s"']*)\?[^\s"']*/g, '$1')
}

function redactedCopy(error: unknown): Error {
  const source = error instanceof Error ? error : new Error(String(error))
  // `cause` is deliberately not propagated: Sentry's linkedErrorsIntegration
  // walks it by default and would re-leak the unscrubbed original.
  const redacted = new Error(redactUrls(source.message))
  redacted.name = source.name
  if (source.stack) redacted.stack = redactUrls(source.stack)
  return redacted
}

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
 * A render that outlives its deadline, or whose `callerSignal` aborts, is
 * given up on: its viewer is torn down and the queue moves on, but the
 * underlying transfer and parse are not abortable and run to completion in
 * the background.
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
    // Classify by the caught error's identity, not `callerSignal.aborted` at
    // catch time: a mutable flag read after the fact cannot tell a genuine
    // render fault from an unrelated abort landing in the same tick.
    if (error === cancelError) return { status: 'cancelled' }
    reportError(redactedCopy(error), {
      errorType: 'agent_model_thumbnail_generation_failure'
    })
    return { status: 'failed' }
  } finally {
    if (onCallerAbort) callerSignal?.removeEventListener('abort', onCallerAbort)
    // Swallow late rejection from the abandoned background render so an
    // abort/timeout never surfaces as an unhandled rejection.
    renderPromise.catch(() => {})
  }
}

async function renderThumbnail(
  modelUrl: string,
  assetName: string,
  signal: AbortSignal
): Promise<string> {
  // The deadline covers the whole render body, not just `loadModel`, because
  // `queue` is module-global and serial: a stalled chunk fetch or a capture
  // that never settles would otherwise block every later caller. Racing a
  // timer rather than awaiting a wrapped body is what lets this promise
  // settle while the unabortable transfer/parse runs on in the background.
  const deadline = new AbortController()
  const onSignalAbort = () => deadline.abort()
  signal.addEventListener('abort', onSignalAbort, { once: true })
  let timer: ReturnType<typeof setTimeout>
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      deadline.abort()
      reject(new TimeoutError())
    }, MODEL_LOAD_TIMEOUT_MS)
  })
  try {
    return await Promise.race([
      renderThumbnailInner(modelUrl, assetName, deadline.signal),
      timedOut
    ])
  } finally {
    clearTimeout(timer!)
    deadline.abort()
    signal.removeEventListener('abort', onSignalAbort)
  }
}

async function renderThumbnailInner(
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
