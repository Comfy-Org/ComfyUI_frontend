import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

const GRAPH_VIEWPORT_SELECTOR = '[data-graph-viewport]'
const GRAPH_VIEWPORT_OCCLUDER_SELECTOR = '[data-graph-viewport-occluder]'

function intersectsVertically(a: DOMRect, b: DOMRect): boolean {
  return a.top < b.bottom && a.bottom > b.top
}

export function visibleCanvasViewport(canvas: LGraphCanvas): ReadOnlyRect {
  const canvasBounds = canvas.canvas.getBoundingClientRect()
  const viewportBounds = document
    .querySelector(GRAPH_VIEWPORT_SELECTOR)
    ?.getBoundingClientRect()

  if (!viewportBounds) {
    return [0, 0, canvasBounds.width, canvasBounds.height]
  }

  let left = viewportBounds.left
  let right = viewportBounds.right
  const occluders = document.querySelectorAll(GRAPH_VIEWPORT_OCCLUDER_SELECTOR)

  for (const occluder of occluders) {
    const bounds = occluder.getBoundingClientRect()
    if (!intersectsVertically(viewportBounds, bounds)) continue

    if (
      bounds.left <= viewportBounds.left &&
      bounds.right > viewportBounds.left
    ) {
      left = Math.max(left, Math.min(bounds.right, viewportBounds.right))
    }
    if (
      bounds.right >= viewportBounds.right &&
      bounds.left < viewportBounds.right
    ) {
      right = Math.min(right, Math.max(bounds.left, viewportBounds.left))
    }
  }

  return [
    left - canvasBounds.left,
    viewportBounds.top - canvasBounds.top,
    Math.max(right - left, 0),
    viewportBounds.height
  ]
}
