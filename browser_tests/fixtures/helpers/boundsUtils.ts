import type { Page } from '@playwright/test'

export interface CanvasRect {
  x: number
  y: number
  w: number
  h: number
}

export interface MeasureResult {
  selectionBounds: CanvasRect | null
  nodeVisualBounds: Record<string, CanvasRect>
}

// Must match the padding value passed to createBounds() in selectionBorder.ts
const SELECTION_PADDING = 10

export async function measureSelectionBounds(
  page: Page,
  nodeIds: string[]
): Promise<MeasureResult> {
  return page.evaluate(
    ({ ids, padding }) => {
      const canvas = window.app!.canvas
      const ds = canvas.ds

      const selectedItems = canvas.selectedItems
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const item of selectedItems) {
        const rect = item.boundingRect
        minX = Math.min(minX, rect[0])
        minY = Math.min(minY, rect[1])
        maxX = Math.max(maxX, rect[0] + rect[2])
        maxY = Math.max(maxY, rect[1] + rect[3])
      }
      const selectionBounds =
        selectedItems.size > 0
          ? {
              x: minX - padding,
              y: minY - padding,
              w: maxX - minX + 2 * padding,
              h: maxY - minY + 2 * padding
            }
          : null

      const canvasEl = canvas.canvas as HTMLCanvasElement
      const canvasRect = canvasEl.getBoundingClientRect()
      const nodeVisualBounds: Record<
        string,
        { x: number; y: number; w: number; h: number }
      > = {}

      for (const id of ids) {
        const nodeEl = document.querySelector(
          `[data-node-id="${id}"]`
        ) as HTMLElement | null
        if (!nodeEl) continue

        const domRect = nodeEl.getBoundingClientRect()
        const footerEls = nodeEl.querySelectorAll(
          '[data-testid="subgraph-enter-button"], [data-testid="node-footer"]'
        )
        let bottom = domRect.bottom
        for (const footerEl of footerEls) {
          bottom = Math.max(bottom, footerEl.getBoundingClientRect().bottom)
        }

        nodeVisualBounds[id] = {
          x: (domRect.left - canvasRect.left) / ds.scale - ds.offset[0],
          y: (domRect.top - canvasRect.top) / ds.scale - ds.offset[1],
          w: domRect.width / ds.scale,
          h: (bottom - domRect.top) / ds.scale
        }
      }

      return { selectionBounds, nodeVisualBounds }
    },
    { ids: nodeIds, padding: SELECTION_PADDING }
  ) as Promise<MeasureResult>
}
