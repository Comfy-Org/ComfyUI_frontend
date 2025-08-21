import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

/**
 * Draws a dashed border around selected items that maintains constant pixel size
 * regardless of zoom level, similar to the DOM selection overlay.
 */
function drawSelectionBorder(
  ctx: CanvasRenderingContext2D,
  canvas: LGraphCanvas
) {
  const selectedItems = canvas.selectedItems

  // Only draw if multiple items selected
  if (selectedItems.size <= 1) return

  // Calculate bounds of all selected items
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const item of selectedItems) {
    if ('pos' in item && 'size' in item) {
      // It's a node
      const node = item as any
      minX = Math.min(minX, node.pos[0])
      minY = Math.min(minY, node.pos[1])
      maxX = Math.max(maxX, node.pos[0] + node.size[0])
      maxY = Math.max(maxY, node.pos[1] + node.size[1])
    }
  }

  // No valid bounds found
  if (!isFinite(minX)) return

  // Add padding
  const padding = 10
  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding

  // Save context state
  ctx.save()

  // Set up dashed line style that doesn't scale with zoom
  const borderWidth = 2 / canvas.ds.scale // Constant 2px regardless of zoom
  ctx.lineWidth = borderWidth
  ctx.strokeStyle =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--border-color')
      .trim() || '#ffffff66'

  // Create dash pattern that maintains visual size
  const dashSize = 5 / canvas.ds.scale
  ctx.setLineDash([dashSize, dashSize])

  // Draw the border
  ctx.beginPath()
  ctx.roundRect(minX, minY, maxX - minX, maxY - minY, 8 / canvas.ds.scale)
  ctx.stroke()

  // Restore context
  ctx.restore()
}

/**
 * Extension that adds a dashed selection border for multiple selected nodes
 */
const ext = {
  name: 'Comfy.SelectionBorder',

  async init() {
    // Hook into the canvas drawing
    const originalDrawForeground = app.canvas.onDrawForeground

    app.canvas.onDrawForeground = function (
      ctx: CanvasRenderingContext2D,
      visibleArea: any
    ) {
      // Call original if it exists
      originalDrawForeground?.call(this, ctx, visibleArea)

      // Draw our selection border
      drawSelectionBorder(ctx, app.canvas)
    }
  }
}

app.registerExtension(ext)
