import {
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'
import { reportError } from '@/platform/telemetry/reportError'

let queue: Promise<unknown> = Promise.resolve()
const MODEL_THUMBNAIL_TIMEOUT_MS = 10_000

/**
 * Render a model to a thumbnail data URL offscreen, without opening the
 * viewer. Runs one generation at a time to bound live WebGL contexts and
 * persists the result through the asset API so other surfaces pick it up.
 * Resolves null when the model cannot be rendered.
 */
export function generateModelThumbnail(
  modelUrl: string,
  assetName: string
): Promise<string | null> {
  const run = queue.then(() => renderThumbnailWithTimeout(modelUrl, assetName))
  queue = run.catch(() => null)
  return run
}

async function renderThumbnailWithTimeout(
  modelUrl: string,
  assetName: string
): Promise<string | null> {
  const abortController = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutError = new Error('Model thumbnail generation timed out')

  try {
    return await Promise.race([
      renderThumbnail(modelUrl, assetName, abortController.signal),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort(timeoutError)
          reject(timeoutError)
        }, MODEL_THUMBNAIL_TIMEOUT_MS)
      })
    ])
  } catch (error) {
    reportError(error, {
      errorType: 'agent_model_thumbnail_generation_failure'
    })
    return null
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
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
    await load3d.loadModel(modelUrl)
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
