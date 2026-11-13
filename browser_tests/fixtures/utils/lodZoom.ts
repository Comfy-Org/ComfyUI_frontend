import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const LOD_CLEARANCE = 1.2

/** Raises the canvas zoom when Vue nodes are rendered as boxes. */
export async function ensureNodesAddressable(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(async (clearance) => {
    const app = window.app
    const liteGraph = window.LiteGraph
    if (!app || !liteGraph) return
    const canvas = app.canvas

    const vueNodesEnabled = await app.extensionManager.setting.get(
      'Comfy.VueNodes.Enabled'
    )
    if (!vueNodesEnabled) return

    const minFontSize = canvas.min_font_size_for_lod
    if (minFontSize <= 0) return

    const textSize = liteGraph.NODE_TEXT_SIZE
    const dprAdjustment = Math.sqrt(window.devicePixelRatio)
    const minimumVisibleZoom = minFontSize / (textSize * dprAdjustment)
    const minimumInteractiveZoom =
      minimumVisibleZoom * (liteGraph.vueNodesSuspended ? clearance : 1)

    if (canvas.ds.scale < minimumInteractiveZoom) {
      canvas.ds.changeScale(minimumVisibleZoom * clearance)
      canvas.setDirty(true, true)
    }
  }, LOD_CLEARANCE)

  await comfyPage.nextFrame()
}
