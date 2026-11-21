import { useApp } from '@/scripts/appInstance'
import { useWidgetHistoryStore } from '@/stores/widgetHistoryStore'
import type { HistoryDirection } from '@/stores/widgetHistoryStore'

function isTextEditor(element: Element): boolean {
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

export function travelFocusedNodeHistory(direction: HistoryDirection): boolean {
  const focused = document.activeElement
  if (!focused || isTextEditor(focused)) return false
  const nodeId = focused.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
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
