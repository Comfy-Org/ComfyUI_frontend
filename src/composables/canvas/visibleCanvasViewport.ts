import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

export interface CanvasViewportConstraints {
  top?: number
  right?: number
  bottom?: number
  left?: number
  occlusions?: readonly ReadOnlyRect[]
}

function subtractOcclusion(
  viewport: ReadOnlyRect,
  occlusion: ReadOnlyRect
): ReadOnlyRect[] {
  const [x, y, width, height] = viewport
  const right = x + width
  const bottom = y + height
  const overlapLeft = Math.max(x, occlusion[0])
  const overlapTop = Math.max(y, occlusion[1])
  const overlapRight = Math.min(right, occlusion[0] + occlusion[2])
  const overlapBottom = Math.min(bottom, occlusion[1] + occlusion[3])

  if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
    return [viewport]
  }

  const candidates: ReadOnlyRect[] = [
    [x, y, width, overlapTop - y],
    [overlapRight, y, right - overlapRight, height],
    [x, overlapBottom, width, bottom - overlapBottom],
    [x, y, overlapLeft - x, height]
  ]

  return candidates.filter((rect) => rect[2] > 0 && rect[3] > 0)
}

export function visibleCanvasViewport(
  canvas: LGraphCanvas,
  constraints: CanvasViewportConstraints = {}
): ReadOnlyRect {
  const canvasRect = canvas.canvas.getBoundingClientRect()
  const panelRect =
    canvas.canvas.ownerDocument
      .querySelector<HTMLElement>('.graph-canvas-panel')
      ?.getBoundingClientRect() ?? canvasRect
  const left = Math.max(canvasRect.left, panelRect.left)
  const top = Math.max(canvasRect.top, panelRect.top)
  const right = Math.min(
    canvasRect.left + canvasRect.width,
    panelRect.left + panelRect.width
  )
  const bottom = Math.min(
    canvasRect.top + canvasRect.height,
    panelRect.top + panelRect.height
  )
  const viewport: ReadOnlyRect = [
    left - canvasRect.left,
    top - canvasRect.top,
    Math.max(0, right - left),
    Math.max(0, bottom - top)
  ]
  const insetLeft = Math.min(viewport[2], Math.max(0, constraints.left ?? 0))
  const insetTop = Math.min(viewport[3], Math.max(0, constraints.top ?? 0))
  const insetRight = Math.max(0, constraints.right ?? 0)
  const insetBottom = Math.max(0, constraints.bottom ?? 0)
  const insetViewport: ReadOnlyRect = [
    viewport[0] + insetLeft,
    viewport[1] + insetTop,
    Math.max(0, viewport[2] - insetLeft - insetRight),
    Math.max(0, viewport[3] - insetTop - insetBottom)
  ]
  const visibleRects = (constraints.occlusions ?? []).reduce<ReadOnlyRect[]>(
    (rects, occlusion) =>
      rects.flatMap((rect) => subtractOcclusion(rect, occlusion)),
    [insetViewport]
  )

  return visibleRects.reduce<ReadOnlyRect>(
    (largest, rect) =>
      rect[2] * rect[3] > largest[2] * largest[3] ? rect : largest,
    [insetViewport[0], insetViewport[1], 0, 0]
  )
}
