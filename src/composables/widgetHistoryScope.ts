import type { LGraph } from '@comfyorg/litegraph/litegraph'
import { useApp } from '@/scripts/appInstance'
import type { WidgetHistoryScope } from '@/stores/widgetHistoryStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { parseNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { widgetId } from '@comfyorg/graph-model/widgetId'

export type LocatedWidget = Pick<SimplifiedWidget, 'name' | 'nodeLocatorId'>

export function locateWidgetNode(
  widget: LocatedWidget,
  fallbackNodeId?: NodeId
): { graph: LGraph; nodeId: NodeId } | null {
  const located = widget.nodeLocatorId
    ? parseNodeLocatorId(widget.nodeLocatorId)
    : null
  if (!located) {
    const graph = useApp().canvas.graph
    return graph && fallbackNodeId !== undefined
      ? { graph, nodeId: fallbackNodeId }
      : null
  }
  const graph = located.subgraphUuid
    ? useApp().rootGraph.subgraphs.get(located.subgraphUuid)
    : useApp().rootGraph
  return graph ? { graph, nodeId: located.localNodeId } : null
}

export function widgetHistoryScope(
  widget: LocatedWidget,
  fallbackNodeId?: NodeId
): WidgetHistoryScope | null {
  const location = locateWidgetNode(widget, fallbackNodeId)
  return location
    ? {
        rootGraphId: useApp().rootGraph.id,
        widgetId: widgetId(location.graph.id, location.nodeId, widget.name)
      }
    : null
}
