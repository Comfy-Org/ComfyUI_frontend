import type { Bounds } from '@comfyorg/shared-frontend-utils/geometry'
import { boundsIntersect } from '@/renderer/core/layout/utils/layoutMath'

export interface NodeBoxSlot {
  x: number
  y: number
  color?: string
}

export interface NodeBoxWidget {
  x: number
  y: number
  width: number
  height: number
}

export interface NodeBox {
  bounds: Bounds
  color?: string
  titleColor?: string
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

const SLOT_SIZE = 8

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

/** Draws boxes in graph space under the camera transform; returns how many were drawn. */
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

  const visible: NodeBox[] = []
  for (const box of boxes) {
    if (boundsIntersect(box.bounds, viewport)) visible.push(box)
  }

  let currentColor = ''
  const setFill = (fill: string | undefined, fallback: string) => {
    const desired = fill || fallback
    if (desired === currentColor) return

    ctx.fillStyle = fallback
    if (desired !== fallback) ctx.fillStyle = desired
    currentColor = ctx.fillStyle
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
  drawNodeBoxWidgets(ctx, visible)

  for (const { slots = [] } of visible) {
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

function drawNodeBoxWidgets(
  ctx: CanvasRenderingContext2D,
  boxes: readonly NodeBox[]
): void {
  for (const { widgets = [] } of boxes) {
    for (const widget of widgets) {
      ctx.fillRect(widget.x, widget.y, widget.width, widget.height)
    }
  }
}
