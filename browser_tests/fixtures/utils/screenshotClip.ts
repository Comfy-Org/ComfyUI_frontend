import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

/**
 * Compute a clip region encompassing one or more nodes on the canvas.
 * Returns page-level coordinates for use with
 * `page.toHaveScreenshot({ clip })`.
 *
 * Accounts for zoom scale, pan offset, title bar height, and
 * canvas element position on page.
 */
export async function getNodeClipRegion(
  comfyPage: ComfyPage,
  nodeIds: NodeId[],
  padding = 40
): Promise<{ x: number; y: number; width: number; height: number }> {
  const canvasBox = await comfyPage.canvas.boundingBox()
  if (!canvasBox) throw new Error('Canvas element not visible')

  const region = await comfyPage.page.evaluate(
    ([ids, pad]) => {
      const canvas = window.app!.canvas
      const ds = canvas.ds

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (const id of ids) {
        const node = canvas.graph!.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found`)

        const pos = ds.convertOffsetToCanvas([node.pos[0], node.pos[1]])
        const scaledWidth = node.size[0] * ds.scale
        const scaledHeight = node.size[1] * ds.scale
        const titleHeight = window.LiteGraph!.NODE_TITLE_HEIGHT * ds.scale

        minX = Math.min(minX, pos[0])
        minY = Math.min(minY, pos[1] - titleHeight)
        maxX = Math.max(maxX, pos[0] + scaledWidth)
        maxY = Math.max(maxY, pos[1] + scaledHeight)
      }

      return {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2
      }
    },
    [nodeIds, padding] as const
  )

  return {
    x: Math.max(0, canvasBox.x + region.x),
    y: Math.max(0, canvasBox.y + region.y),
    width: region.width,
    height: region.height
  }
}
