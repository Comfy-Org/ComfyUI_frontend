import { useApp } from '@/scripts/appInstance'
import { useWidgetHistoryStore } from '@/stores/widgetHistoryStore'
import type { HistoryDirection } from '@/stores/widgetHistoryStore'

export function travelFocusedNodeHistory(direction: HistoryDirection): boolean {
  const nodeId =
    document.activeElement?.closest<HTMLElement>('[data-node-id]')?.dataset
      .nodeId
  const { canvas, rootGraph } = useApp()
  if (nodeId === undefined || !canvas.graph) return false
  const step = useWidgetHistoryStore().latestTraveler(
    { rootGraphId: rootGraph.id, graphId: canvas.graph.id, nodeId },
    direction
  )
  if (!step) return false
  void step.travel()
  return true
}
