import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  widgetName,
  widgetNodeLocatorId
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import { useApp } from '@/scripts/appInstance'
import type { WidgetHistoryScope } from '@/stores/widgetHistoryStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { parseNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

export function locateWidgetNode(
  id: WidgetId,
  fallbackNodeId?: NodeId
): { graph: LGraph; nodeId: NodeId } | null {
  const nodeLocatorId = widgetNodeLocatorId(id)
  const located = nodeLocatorId ? parseNodeLocatorId(nodeLocatorId) : null
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
  id: WidgetId,
  fallbackNodeId?: NodeId
): WidgetHistoryScope | null {
  const location = locateWidgetNode(id, fallbackNodeId)
  return location
    ? {
        rootGraphId: useApp().rootGraph.id,
        widgetId: widgetId(location.graph.id, location.nodeId, widgetName(id))
      }
    : null
}
