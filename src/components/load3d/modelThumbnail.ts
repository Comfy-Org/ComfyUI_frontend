import {
  isAssetPreviewSupported,
  persistThumbnailFromDataUrl,
  THUMBNAIL_CAPTURE_SIZE
} from '@/platform/assets/utils/assetPreviewUtil'

let queue: Promise<unknown> = Promise.resolve()

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
      width: THUMBNAIL_CAPTURE_SIZE,
      height: THUMBNAIL_CAPTURE_SIZE,
      isViewerMode: true
    })
    try {
      await load3d.loadModel(modelUrl)
      const dataUrl = await load3d.captureThumbnail(
        THUMBNAIL_CAPTURE_SIZE,
        THUMBNAIL_CAPTURE_SIZE
      )
      if (isAssetPreviewSupported()) {
        void persistThumbnailFromDataUrl(assetName, dataUrl)
      }
      return dataUrl
    } finally {
      load3d.remove()
    }
  } catch {
    return null
  }
}
