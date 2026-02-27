import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
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

  const visited = new Set<string>()
  let currentHost = hostNode
  let currentNodeId = widget.sourceNodeId
  let currentWidgetName = widget.sourceWidgetName

  while (true) {
    const key = `${currentHost.id}:${currentNodeId}:${currentWidgetName}`
    if (visited.has(key)) return undefined
    visited.add(key)

    const sourceNode = currentHost.subgraph.getNodeById(currentNodeId)
    if (!sourceNode) return undefined

    const sourceWidget = sourceNode.widgets?.find(
      (entry) => entry.name === currentWidgetName
    )
    if (!sourceWidget) return undefined

    if (!isPromotedWidgetView(sourceWidget)) {
      return {
        node: sourceNode,
        widget: sourceWidget
      }
    }

    if (!sourceWidget.node?.isSubgraphNode?.()) return undefined

    currentHost = sourceWidget.node
    currentNodeId = sourceWidget.sourceNodeId
    currentWidgetName = sourceWidget.sourceWidgetName
  }
}
