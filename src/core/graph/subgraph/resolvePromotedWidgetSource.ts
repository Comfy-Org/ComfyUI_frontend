import type { ResolvedPromotedWidget } from '@/core/graph/subgraph/promotedWidgetTypes'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export function resolvePromotedWidgetSource(
  hostNode: LGraphNode,
  widget: IBaseWidget
): ResolvedPromotedWidget | undefined {
  if (!isPromotedWidgetView(widget)) return undefined
  if (!hostNode.isSubgraphNode()) return undefined

  const result = resolveConcretePromotedWidget(
    hostNode,
    widget.sourceNodeId,
    widget.sourceWidgetName
  )
  if (result.status === 'resolved') return result.resolved

  return undefined
}
