import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

interface ResolvedPromotedWidgetSource {
  node: LGraphNode
  widget: IBaseWidget
}

export function resolvePromotedWidgetSource(
  hostNode: LGraphNode,
  widget: IBaseWidget
): ResolvedPromotedWidgetSource | undefined {
  if (!isPromotedWidgetView(widget)) return undefined
  if (!hostNode.isSubgraphNode()) return undefined

  const graphId = hostNode.graph?.rootGraph?.id
    ? String(hostNode.graph.rootGraph.id)
    : ''

  const result = resolveConcretePromotedWidget(
    hostNode,
    graphId,
    widget.sourceNodeId,
    widget.sourceWidgetName
  )
  if ('resolved' in result) return result.resolved

  return undefined
}
