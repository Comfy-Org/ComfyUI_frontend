import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas, Rectangle } from '@/lib/litegraph/src/litegraph'
import { createBounds, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { app } from '@/scripts/app'

function getSelectionBounds(canvas: LGraphCanvas): ReadOnlyRect | null {
  const selectedItems = canvas.selectedItems
  if (selectedItems.size <= 1) return null

  if (!LiteGraph.vueNodesMode) return createBounds(selectedItems, 10)

  // In Vue mode, use layoutStore.collapsedSize for collapsed nodes
  // to get accurate dimensions instead of litegraph's fallback values.
  const padding = 10
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const item of selectedItems) {
    const rect = item.boundingRect
    const id = 'id' in item ? String(item.id) : null
    const isCollapsed =
      'flags' in item &&
      !!(item as { flags?: { collapsed?: boolean } }).flags?.collapsed
    const collapsedSize =
      id && isCollapsed ? layoutStore.getNodeCollapsedSize(id) : undefined

    if (collapsedSize) {
      minX = Math.min(minX, rect[0])
      minY = Math.min(minY, rect[1])
      maxX = Math.max(maxX, rect[0] + collapsedSize.width)
      maxY = Math.max(maxY, rect[1] + collapsedSize.height)
    } else {
      minX = Math.min(minX, rect[0])
      minY = Math.min(minY, rect[1])
      maxX = Math.max(maxX, rect[0] + rect[2])
      maxY = Math.max(maxY, rect[1] + rect[3])
    }
  }

  if (!Number.isFinite(minX)) return null
  return [
    minX - padding,
    minY - padding,
    maxX - minX + 2 * padding,
    maxY - minY + 2 * padding
  ]
}

function drawSelectionBorder(
  ctx: CanvasRenderingContext2D,
  canvas: LGraphCanvas
) {
  const bounds = getSelectionBounds(canvas)
  if (!bounds) return

  const [x, y, width, height] = bounds

  ctx.save()

  const borderWidth = 2 / canvas.ds.scale
  ctx.lineWidth = borderWidth
  ctx.strokeStyle =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--border-color')
      .trim() || '#ffffff66'

  const dashSize = 5 / canvas.ds.scale
  ctx.setLineDash([dashSize, dashSize])

  ctx.beginPath()
  ctx.roundRect(x, y, width, height, 8 / canvas.ds.scale)
  ctx.stroke()

  ctx.restore()
}

const ext = {
  name: 'Comfy.SelectionBorder',

  async init() {
    const originalDrawForeground = app.canvas.onDrawForeground

    app.canvas.onDrawForeground = function (
      ctx: CanvasRenderingContext2D,
      visibleArea: Rectangle
    ) {
      originalDrawForeground?.call(this, ctx, visibleArea)
      drawSelectionBorder(ctx, app.canvas)
    }
  }
}

app.registerExtension(ext)
