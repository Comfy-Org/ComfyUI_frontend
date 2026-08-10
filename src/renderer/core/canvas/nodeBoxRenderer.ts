/**
 * Draws nodes as plain filled rectangles.
 *
 * Used while the view is zoomed out far enough that node contents would be
 * illegible, where a node resolves to little more than a rectangle on screen
 * anyway. Pure canvas drawing with no graph or renderer dependencies: it needs
 * only a 2D context and a set of bounds.
 */
import type { Bounds } from '@/renderer/core/layout/types'

export interface NodeBox {
  bounds: Bounds
  /** Node's own colour; falls back to the shared default when absent. */
  color?: string
}

export interface NodeBoxStyle {
  defaultColor: string
}

export interface NodeBoxCamera {
  x: number
  y: number
  z: number
}

/**
 * Rectangles are drawn in graph space with the camera applied to the context,
 * matching how the other canvas layers position themselves.
 *
 * @returns how many boxes were actually drawn
 */
export function drawNodeBoxes(
  ctx: CanvasRenderingContext2D,
  boxes: Iterable<NodeBox>,
  camera: NodeBoxCamera,
  viewport: Bounds,
  style: NodeBoxStyle
): number {
  const scale = camera.z || 1

  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(camera.x, camera.y)

  let drawn = 0
  let currentColor = ''

  for (const { bounds, color } of boxes) {
    if (!intersects(bounds, viewport)) continue

    // Batching by colour avoids a state change per node; most nodes in a graph
    // share the default.
    const fill = color || style.defaultColor
    if (fill !== currentColor) {
      ctx.fillStyle = fill
      currentColor = fill
    }

    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    drawn++
  }

  ctx.restore()
  return drawn
}

function intersects(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}
