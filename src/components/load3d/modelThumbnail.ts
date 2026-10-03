import { TimeoutError } from 'es-toolkit'

import {
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'
import { reportError } from '@/platform/telemetry/reportError'
import { redactTelemetryError } from '@/platform/telemetry/redactTelemetryUrls'
import type { SharedRendererHandle } from '@/renderer/three/sharedWebGLRenderer'

let queue: Promise<unknown> = Promise.resolve()
const MODEL_LOAD_TIMEOUT_MS = 15_000
const MAX_QUEUED_RENDERS = 32
const RENDER_CANCELLED = new Error('Model thumbnail render cancelled')
const RENDER_FAILED = new Error('Model thumbnail load did not complete')
let queuedRenderCount = 0
let rendererKeepAlive: SharedRendererHandle | null = null

/**
 * Outcome of an offscreen thumbnail render. `cancelled` is separated from
 * `failed` so a caller that walked away is not reported as a fault.
 */
export type ModelThumbnailResult =
  | { status: 'rendered'; dataUrl: string }
  | { status: 'cancelled' }
  | { status: 'busy' }
  | { status: 'timedOut' }
  | { status: 'failed' }

/**
 * Render a model to a thumbnail data URL offscreen, without opening the
 * viewer. Starts one render at a time and persists the result through the
 * asset API so other surfaces pick it up.
 *
 * A render that outlives its deadline, or whose `callerSignal` aborts, is
 * given up on: its viewer is torn down and the queue moves on. Underlying
 * transfer and parse work may continue, so its admission slot and renderer
 * lease remain held until that work settles.
 */
export function generateModelThumbnail(
  modelUrl: string,
  assetName: string,
  callerSignal?: AbortSignal
): Promise<ModelThumbnailResult> {
  if (callerSignal?.aborted) {
    return Promise.resolve({ status: 'cancelled' })
  }
  if (queuedRenderCount >= MAX_QUEUED_RENDERS) {
    return Promise.resolve({ status: 'busy' })
  }

  queuedRenderCount++
  const started = queue.then((): ThumbnailTask | ModelThumbnailResult => {
    if (callerSignal?.aborted) return { status: 'cancelled' }
    return renderThumbnailWithTimeout(modelUrl, assetName, callerSignal)
  })
  const run = started.then((task) =>
    'result' in task ? task.result : Promise.resolve(task)
  )
  queue = run.catch(() => null)
  void started.then(async (task) => {
    if ('completed' in task) await task.completed
    queuedRenderCount--
    if (queuedRenderCount === 0) {
      rendererKeepAlive?.release()
      rendererKeepAlive = null
    }
  })
  return run
}

type ThumbnailTask = {
  result: Promise<ModelThumbnailResult>
  completed: Promise<void>
}

function renderThumbnailWithTimeout(
  modelUrl: string,
  assetName: string,
  callerSignal?: AbortSignal
): ThumbnailTask {
  const task = renderThumbnailJob(modelUrl, assetName, callerSignal)
  return {
    completed: task.completed,
    result: task.result.then(
      (dataUrl): ModelThumbnailResult => ({ status: 'rendered', dataUrl }),
      (error: unknown): ModelThumbnailResult => {
        if (error === RENDER_CANCELLED) return { status: 'cancelled' }
        if (error instanceof TimeoutError) return { status: 'timedOut' }
        reportError(redactTelemetryError(error), {
          errorType: 'agent_model_thumbnail_generation_failure',
          surface: 'agent'
        })
        return { status: 'failed' }
      }
    )
  }
}

function renderThumbnailJob(
  modelUrl: string,
  assetName: string,
  callerSignal?: AbortSignal
): { result: Promise<string>; completed: Promise<void> } {
  const deadline = new AbortController()
  const operation = (async () => {
    const { acquireSharedRenderer } =
      await import('@/renderer/three/sharedWebGLRenderer')
    deadline.signal.throwIfAborted()
    rendererKeepAlive ??= acquireSharedRenderer()
    return renderThumbnailInner(modelUrl, assetName, deadline.signal)
  })()
  const result = new Promise<string>((resolve, reject) => {
    let settled = false
    const finish = (): boolean => {
      if (settled) return false
      settled = true
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', onCallerAbort)
      deadline.abort()
      return true
    }
    const settleResolved = (dataUrl: string) => {
      if (finish()) resolve(dataUrl)
    }
    const settleRejected = (error: Error) => {
      if (finish()) reject(error)
    }
    const onCallerAbort = () => settleRejected(RENDER_CANCELLED)
    const timer = setTimeout(
      () => settleRejected(new TimeoutError()),
      MODEL_LOAD_TIMEOUT_MS
    )
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true })

    void operation.then(settleResolved, (error: unknown) =>
      settleRejected(error instanceof Error ? error : new Error(String(error)))
    )
  })
  return {
    result,
    completed: operation.then(
      () => {},
      () => {}
    )
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
    const outcome = await load3d.loadModel(modelUrl, undefined, {
      silent: true
    })
    if (outcome === 'cancelled') throw RENDER_CANCELLED
    if (outcome !== 'loaded') throw RENDER_FAILED
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
