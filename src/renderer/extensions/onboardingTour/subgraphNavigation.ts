import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

/**
 * Return the canvas to the root graph. Called defensively before each step in
 * case the user opened a subgraph manually — view-only, no graph mutation
 * (ADR-0008). The tour itself never enters a subgraph.
 */
export function restoreView() {
  useCanvasStore().canvas?.setGraph(app.rootGraph)
}
