import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createBounds } from '@/lib/litegraph/src/litegraph'

/* Frames the whole graph, not the selection, inside the visible canvas area. */
export function fitGraphToView(canvas: LGraphCanvas): void {
  const bounds = createBounds(canvas.positionableItems)
  if (!bounds) return
  canvas.animateToBounds(bounds, { viewport: visibleCanvasViewport(canvas) })
}
