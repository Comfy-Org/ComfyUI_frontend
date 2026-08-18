/**
 * Draws nodes in the simplified form litegraph uses when zoomed out.
 *
 * Matches `LGraphCanvas.drawNode` under `low_quality`, which is not a plain
 * rectangle: it still draws the title bar in the node's own colour, the slots
 * as small squares, and the widgets as rectangles - it drops only text,
 * rounding, strokes, badges and shadows. Rendering less than that makes the
 * graph change shape at the threshold rather than just losing detail.
 *
 * Pure canvas drawing with no graph or renderer dependencies: it needs only a
 * 2D context and plain data.
 */
import type { Bounds } from '@/renderer/core/layout/types'

/** Centre of a slot, in graph space. */
export interface NodeBoxSlot {
  x: number
  y: number
  /** Type colour; falls back to the shared default when absent. */
  color?: string
}

export interface NodeBoxWidget {
  x: number
  y: number
  width: number
  height: number
}

export interface NodeBox {
  /** Full node rect, title bar included. */
  bounds: Bounds
  /** Node's own background; falls back to the shared default when absent. */
  color?: string
  /** Title bar colour; falls back to the shared title default when absent. */
  titleColor?: string
  /** Height of the title strip at the top of {@link bounds}. */
  titleHeight?: number
  slots?: readonly NodeBoxSlot[]
  widgets?: readonly NodeBoxWidget[]
}

export interface NodeBoxStyle {
  defaultColor: string
  defaultTitleColor: string
  defaultSlotColor: string
  widgetColor: string
}

export interface NodeBoxCamera {
  x: number
  y: number
  z: number
}

/** Matches litegraph's low-quality slot: a small filled square, no stroke. */
const SLOT_SIZE = 8

/** Separator between title bar and body; litegraph draws this at all zooms. */
const SEPARATOR_COLOR = 'rgba(0,0,0,0.2)'

export function includeNodeTitleInBounds(
  bounds: Bounds,
  titleHeight: number
): Bounds {
  return {
    ...bounds,
    y: bounds.y - titleHeight,
    height: bounds.height + titleHeight
  }
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

  // Drawn in passes so the whole graph shares one fillStyle per pass, rather
  // than cycling body/title/slot colours once per node.
  const visible: NodeBox[] = []
  for (const box of boxes) {
    if (intersects(box.bounds, viewport)) visible.push(box)
  }

  let currentColor = ''
  const setFill = (fill: string | undefined, fallback: string) => {
    const desired = fill || fallback
    if (desired === currentColor) return

    ctx.fillStyle = fallback
    if (desired !== fallback) ctx.fillStyle = desired
    currentColor = String(ctx.fillStyle)
  }

  for (const { bounds, color } of visible) {
    setFill(color, style.defaultColor)
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
  }

  for (const { bounds, titleColor, titleHeight } of visible) {
    if (!titleHeight) continue
    setFill(titleColor, style.defaultTitleColor)
    ctx.fillRect(bounds.x, bounds.y, bounds.width, titleHeight)
  }

  setFill(SEPARATOR_COLOR, SEPARATOR_COLOR)
  for (const { bounds, titleHeight } of visible) {
    if (!titleHeight) continue
    ctx.fillRect(bounds.x, bounds.y + titleHeight - 1, bounds.width, 2)
  }

  setFill(style.widgetColor, style.widgetColor)
  for (const { widgets } of visible) {
    if (!widgets) continue
    for (const widget of widgets) {
      ctx.fillRect(widget.x, widget.y, widget.width, widget.height)
    }
  }

  for (const { slots } of visible) {
    if (!slots) continue
    for (const slot of slots) {
      setFill(slot.color, style.defaultSlotColor)
      ctx.fillRect(
        slot.x - SLOT_SIZE / 2,
        slot.y - SLOT_SIZE / 2,
        SLOT_SIZE,
        SLOT_SIZE
      )
    }
  }

  ctx.restore()
  return visible.length
}

function intersects(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}
