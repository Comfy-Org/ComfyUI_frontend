import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

export function visibleCanvasViewport(canvas: LGraphCanvas): ReadOnlyRect {
  const canvasRect = canvas.canvas.getBoundingClientRect()
  const width = canvasRect.width || canvas.canvas.width / canvas.dpr
  const height = canvasRect.height || canvas.canvas.height / canvas.dpr
  const panel = document.querySelector<HTMLElement>('.graph-canvas-panel')
  if (!panel) return [0, 0, width, height]

  const panelRect = panel.getBoundingClientRect()
  const overlapsHorizontally =
    panelRect.right > canvasRect.left && panelRect.left < canvasRect.right
  if (!overlapsHorizontally) return [0, 0, width, height]

  const left = Math.max(0, panelRect.left - canvasRect.left)
  const right = Math.max(0, canvasRect.right - panelRect.right)
  return [left, 0, Math.max(width - left - right, 0), height]
}
