import { withTimeout } from 'es-toolkit'

import {
  isAssetPreviewSupported,
  persistThumbnail
} from '@/platform/assets/utils/assetPreviewUtil'

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
  try {
    const { createLoad3d } =
      await import('@/extensions/core/load3d/createLoad3d')
    const load3d = createLoad3d(document.createElement('div'), {
      width: 256,
      height: 256,
      isViewerMode: true
    })
    try {
      await withTimeout(() => load3d.loadModel(modelUrl), MODEL_LOAD_TIMEOUT_MS)
      const dataUrl = await load3d.captureThumbnail(256, 256)
      if (isAssetPreviewSupported()) {
        void fetch(dataUrl)
          .then((response) => response.blob())
          .then((blob) => persistThumbnail(assetName, blob))
          .catch(() => {})
      }
      return dataUrl
    } finally {
      load3d.remove()
    }
  } catch {
    return null
  }
}
