import { withTimeout } from 'es-toolkit'

import type Load3d from '@/extensions/core/load3d/Load3d'
import {
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'
import { reportError } from '@/platform/telemetry/reportError'

let queue: Promise<unknown> = Promise.resolve()
const MODEL_LOAD_TIMEOUT_MS = 15_000

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
  const run = queue.then(() => renderThumbnail(modelUrl, assetName))
  queue = run.catch(() => null)
  return run
}

async function renderThumbnail(
  modelUrl: string,
  assetName: string
): Promise<string | null> {
  // Bounds the whole offscreen render (dynamic import, WebGL context
  // creation, load, and capture), not just the load step — a stall in any
  // of them would otherwise wedge `queue` (module-global, never reset) for
  // the rest of the session, which is the exact head-of-line failure this
  // module exists to prevent.
  const holder: { current: Load3d | null } = { current: null }
  try {
    return await withTimeout(async () => {
      const { createLoad3d } =
        await import('@/extensions/core/load3d/createLoad3d')
      const instance = createLoad3d(document.createElement('div'), {
        width: 256,
        height: 256,
        isViewerMode: true
      })
      holder.current = instance
      await instance.loadModel(modelUrl)
      const dataUrl = await instance.captureThumbnail(256, 256)
      if (isAssetPreviewSupported()) {
        void fetch(dataUrl)
          .then((response) => response.blob())
          .then((blob) => persistThumbnail(assetName, blob))
          .catch(() => {})
      }
      return dataUrl
    }, MODEL_LOAD_TIMEOUT_MS)
  } catch (error) {
    reportError(error, { errorType: 'load3d_thumbnail_generation_failed' })
    return null
  } finally {
    // The timeout only rejects the wrapper — it cannot cancel whatever step
    // is still in flight inside it. Invalidate the load before disposing so
    // an abandoned `loadModel` that resolves afterward is a no-op (same
    // staleness check that already guards overlapping loads on one
    // instance) instead of calling setupModel() on a disposed manager.
    holder.current?.getLoaderManager().invalidate()
    holder.current?.remove()
  }
}
