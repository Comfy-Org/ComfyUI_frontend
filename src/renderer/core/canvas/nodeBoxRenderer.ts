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

type NodeBoxContext = Pick<
  CanvasRenderingContext2D,
  'save' | 'restore' | 'scale' | 'translate' | 'fillRect' | 'fillStyle'
>

/** Draws boxes in graph space under the camera transform, each node over the ones before it; returns how many were drawn. */
export function drawNodeBoxes(
  ctx: NodeBoxContext,
  boxes: Iterable<NodeBox>,
  camera: NodeBoxCamera,
  viewport: Bounds,
  style: NodeBoxStyle
): number {
  const scale = camera.z || 1

  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(camera.x, camera.y)

  let currentColor: NodeBoxContext['fillStyle'] = ''
  const setFill = (fill: string | undefined, fallback: string) => {
    const desired = fill || fallback
    if (desired === currentColor) return

    ctx.fillStyle = fallback
    if (desired !== fallback) ctx.fillStyle = desired
    currentColor = ctx.fillStyle
  }

  let drawn = 0
  for (const box of boxes) {
    if (!boundsIntersect(box.bounds, viewport)) continue
    drawn++
    const { bounds, titleHeight, widgets = [], slots = [] } = box

    setFill(box.color, style.defaultColor)
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)

    if (titleHeight) {
      setFill(box.titleColor, style.defaultTitleColor)
      ctx.fillRect(bounds.x, bounds.y, bounds.width, titleHeight)
      setFill(SEPARATOR_COLOR, SEPARATOR_COLOR)
      ctx.fillRect(bounds.x, bounds.y + titleHeight - 1, bounds.width, 2)
    }

    setFill(style.widgetColor, style.widgetColor)
    for (const widget of widgets) {
      ctx.fillRect(widget.x, widget.y, widget.width, widget.height)
    }

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
  return drawn
}
