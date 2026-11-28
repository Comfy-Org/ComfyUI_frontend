import type { ReadOnlyRect } from '@comfyorg/shared-frontend-utils/geometry'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

function renderedRect(selector: string): DOMRect | undefined {
  const rect = document.querySelector(selector)?.getBoundingClientRect()
  return rect && rect.width > 0 ? rect : undefined
}

/** The CSS-pixel part of the canvas that no side panel, properties panel or agent panel covers. */
export function measuredVisibleCanvasViewport(
  canvas: Pick<LGraphCanvas, 'ds'>
): ReadOnlyRect | null {
  const [width, height] = canvas.ds.getViewportSize()
  const leftCover = renderedRect('#first-side-panel')
  const rightCovers = [
    renderedRect('#last-side-panel'),
    renderedRect('[data-testid="docked-agent-panel"]')
  ].filter((rect) => rect !== undefined)
  if (!leftCover && rightCovers.length === 0) return [0, 0, width, height]

  const canvasLeft = canvas.ds.element.getBoundingClientRect().left
  const left = Math.max(0, leftCover ? leftCover.right - canvasLeft : 0)
  const right = Math.min(
    width,
    ...rightCovers.map((rect) => rect.left - canvasLeft)
  )
  return right > left ? [left, 0, right - left, height] : null
}

export function visibleCanvasViewport(
  canvas: Pick<LGraphCanvas, 'ds'>
): ReadOnlyRect {
  const [width, height] = canvas.ds.getViewportSize()
  return measuredVisibleCanvasViewport(canvas) ?? [0, 0, width, height]
}
