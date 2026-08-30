import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

export function visibleCanvasViewport(canvas: LGraphCanvas): ReadOnlyRect {
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
  return [
    left - canvasRect.left,
    top - canvasRect.top,
    Math.max(0, right - left),
    Math.max(0, bottom - top)
  ]
}
