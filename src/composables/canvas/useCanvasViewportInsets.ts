import type { ViewportInsets } from '@/lib/litegraph/src/DragAndScale'

/**
 * Calculates the viewport insets by comparing the graph canvas element's
 * bounding rect with the visible graph-canvas-panel (the unobscured area
 * between sidebars/panels). Returns zero insets if elements are not found.
 */
export function getCanvasViewportInsets(): ViewportInsets {
  const canvasEl = document.getElementById('graph-canvas')
  const panelEl = document.querySelector('.graph-canvas-panel')
  if (!canvasEl || !panelEl) return {}

  const canvasRect = canvasEl.getBoundingClientRect()
  const panelRect = panelEl.getBoundingClientRect()

  const left = Math.max(0, panelRect.left - canvasRect.left)
  const right = Math.max(0, canvasRect.right - panelRect.right)
  const top = Math.max(0, panelRect.top - canvasRect.top)
  const bottom = Math.max(0, canvasRect.bottom - panelRect.bottom)

  if (left === 0 && right === 0 && top === 0 && bottom === 0) return {}

  return { left, right, top, bottom }
}
