import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

/**
 * Margin above the threshold. The composable applies 1.15 hysteresis on the way
 * back up, so sitting exactly at the threshold is not enough to stay there.
 */
const LOD_CLEARANCE = 1.2

/**
 * Raises the canvas zoom until Vue nodes exist as DOM elements.
 *
 * Any spec that queries `[data-node-id]` needs this whenever the zoom is not
 * under its own control - a workflow fixture can pin `extra.ds.scale` below the
 * threshold, and `large-graph-workflow.json` does exactly that at 0.5 against a
 * default threshold of 0.571. The symptom is a bare locator timeout with
 * nothing pointing back at the zoom, or a `count() === 0` assertion that passes
 * for the wrong reason.
 *
 * A no-op above the threshold, and when LOD is disabled entirely.
 */
export async function ensureNodesAddressable(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(async (clearance) => {
    const canvas = window.app?.canvas
    if (!canvas) return

    const vueNodesEnabled = await window.app?.extensionManager.setting.get(
      'Comfy.VueNodes.Enabled'
    )
    if (!vueNodesEnabled) return

    const minFontSize = canvas.min_font_size_for_lod ?? 0
    if (minFontSize <= 0) return

    const textSize = window.LiteGraph?.NODE_TEXT_SIZE ?? 14
    const dprAdjustment = Math.sqrt(window.devicePixelRatio || 1)
    const minimumInteractiveZoom =
      (minFontSize / (textSize * dprAdjustment)) * clearance

    if (canvas.ds.scale < minimumInteractiveZoom) {
      canvas.ds.changeScale(minimumInteractiveZoom)
      canvas.setDirty(true, true)
    }
  }, LOD_CLEARANCE)

  await comfyPage.nextFrame()
}
