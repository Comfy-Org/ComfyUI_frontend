import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

export interface CanvasViewportInset {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

export function visibleCanvasViewport(
  canvas: LGraphCanvas,
  inset: CanvasViewportInset = {}
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
  const insetLeft = Math.min(viewport[2], Math.max(0, inset.left ?? 0))
  const insetTop = Math.min(viewport[3], Math.max(0, inset.top ?? 0))
  const insetRight = Math.max(0, inset.right ?? 0)
  const insetBottom = Math.max(0, inset.bottom ?? 0)

  return [
    viewport[0] + insetLeft,
    viewport[1] + insetTop,
    Math.max(0, viewport[2] - insetLeft - insetRight),
    Math.max(0, viewport[3] - insetTop - insetBottom)
  ]
}
