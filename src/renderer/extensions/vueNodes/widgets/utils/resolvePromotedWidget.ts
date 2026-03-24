import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { ResolvedPromotedWidget } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

export function resolveWidgetFromHostNode(
  hostNode: LGraphNode | undefined,
  widgetName: string
): ResolvedPromotedWidget | undefined {
  if (!hostNode) return undefined

  const widget = hostNode.widgets?.find((entry) => entry.name === widgetName)
  if (!widget) return undefined

  const sourceWidget = resolvePromotedWidgetSource(hostNode, widget)
  if (sourceWidget) return sourceWidget

  if (isPromotedWidgetView(widget) && hostNode.isSubgraphNode())
    return undefined

  return {
    node: hostNode,
    widget
  }
}
