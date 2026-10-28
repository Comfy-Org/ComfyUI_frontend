import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import type { WidgetHistoryScope } from '@/stores/widgetHistoryStore'
import type { NodeId } from '@/types/nodeId'
import { parseNodeLocatorId } from '@/types/nodeIdentification'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { widgetId } from '@/types/widgetId'

type LocatedWidget = Pick<SimplifiedWidget, 'name' | 'nodeLocatorId'>

export function locateWidgetNode(
  widget: LocatedWidget,
  fallbackNodeId?: NodeId
): { graph: LGraph; nodeId: NodeId } | null {
  const located = widget.nodeLocatorId
    ? parseNodeLocatorId(widget.nodeLocatorId)
    : null
  if (!located) {
    const graph = app.canvas.graph
    return graph && fallbackNodeId !== undefined
      ? { graph, nodeId: fallbackNodeId }
      : null
  }
  const graph = located.subgraphUuid
    ? app.rootGraph.subgraphs.get(located.subgraphUuid)
    : app.rootGraph
  return graph ? { graph, nodeId: located.localNodeId } : null
}

export function widgetHistoryScope(
  widget: LocatedWidget,
  fallbackNodeId?: NodeId
): WidgetHistoryScope | null {
  const location = locateWidgetNode(widget, fallbackNodeId)
  return location
    ? {
        rootGraphId: app.rootGraph.id,
        widgetId: widgetId(location.graph.id, location.nodeId, widget.name)
      }
    : null
}
