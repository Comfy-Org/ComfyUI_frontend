import { TimeoutError } from 'es-toolkit'

import {
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'
import { reportError } from '@/platform/telemetry/reportError'

let queue: Promise<unknown> = Promise.resolve()
const MODEL_LOAD_TIMEOUT_MS = 15_000

/**
 * `modelUrl` on the agent path is untrusted — `classifyAssetUrl` keeps the
 * raw `href` from the model's markdown reply, which may carry credentials
 * or a signed query string. three.js's `FileLoader` embeds the URL verbatim
 * in its thrown error (`fetch for "<url>" responded with <status>`), and
 * that error's message and stack both reach `reportError` (Sentry/Datadog),
 * so both must be scrubbed before they leave this module: query strings are
 * dropped and `user:pass@` credentials are stripped from any URL-shaped
 * substring. Agent reply assets are also referenced by root-relative URLs
 * (e.g. `/api/view?filename=mesh-0.glb`), which three.js embeds verbatim
 * too, so path-shaped tokens carrying a query string are scrubbed as well.
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
  // A fresh Error, not `new Error(source.message)` alone, so the redacted
  // copy still carries a stack that distinguishes GLTFLoader from
  // FBXLoader from fetchModelData — triage needs that frame. `cause` is
  // deliberately not propagated: Sentry's linkedErrorsIntegration walks it
  // by default and would re-leak the unscrubbed original.
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
 * The whole render (see #16485, extended to cover the full body not just
 * the model load) is bounded by a deadline so a stuck render cannot block
 * the queue forever; a render that outlives its deadline is given up on —
 * its viewer is torn down and the queue moves on — but the underlying
 * transfer and parse are not abortable and run to completion in the
 * background. Aborting `callerSignal` gives up the same way, and skips the
 * render entirely if it has not started yet.
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
    // catch time. One shared AbortController/signal used to cover every
    // model in a group (it no longer does — see the per-url controllers in
    // ReplyAssetGroup.vue), and a mutable flag read after the fact can't
    // tell a genuine render fault (parse error, WebGL fault, the render
    // deadline) from an unrelated abort that lands in the same tick.
    // `cancelError` is the one thing only a real caller-signal abort
    // produces, so compare against it directly.
    if (error === cancelError) return { status: 'cancelled' }
    // modelUrl is untrusted and may be embedded verbatim in three.js's own
    // thrown error (FileLoader's "fetch for <url> responded with <status>");
    // report a redacted copy rather than the original.
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
  // The deadline covers the whole render body, not just `loadModel`: the
  // dynamic `import()` below and `captureThumbnail` run in the same queued
  // task with no deadline of their own, and `queue` is module-global and
  // serial, so a stalled chunk fetch or a capture that never settles would
  // otherwise block every later `generateModelThumbnail` caller.
  //
  // `deadline` is threaded into `renderThumbnailInner` as its abort signal
  // so `remove()` there fires immediately once the deadline (or the outer
  // `signal`) fires, tearing down the viewer the same way a caller cancel
  // does. Racing a plain timer here (rather than wrapping the whole body in
  // `withTimeout`) is what lets this function's own promise settle without
  // waiting on `renderThumbnailInner` — the underlying transfer/parse is
  // not itself abortable and keeps running in the background once given up
  // on; awaiting it here would defeat the deadline entirely.
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
