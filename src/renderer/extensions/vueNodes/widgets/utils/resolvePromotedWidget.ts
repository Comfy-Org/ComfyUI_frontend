import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export type WidgetNodeLike<TNode> = {
  widgets?: IBaseWidget[]
  isSubgraphNode: () => boolean
  subgraph?: {
    getNodeById: (nodeId: string) => TNode | null | undefined
  }
}

export type ResolvedWidget<TNode> = {
  node: TNode
  widget: IBaseWidget
}

export function resolveWidgetFromHostNode<TNode extends WidgetNodeLike<TNode>>(
  hostNode: TNode | undefined,
  widgetName: string
): ResolvedWidget<TNode> | undefined {
  if (!hostNode) return undefined

  const widget = hostNode.widgets?.find((entry) => entry.name === widgetName)
  if (!widget) return undefined

  if (isPromotedWidgetView(widget) && hostNode.isSubgraphNode()) {
    const innerNode = hostNode.subgraph?.getNodeById(widget.sourceNodeId)
    if (!innerNode) return undefined

    const innerWidget = innerNode.widgets?.find(
      (entry) => entry.name === widget.sourceWidgetName
    )
    if (!innerWidget) return undefined

    return {
      node: innerNode,
      widget: innerWidget
    }
  }

  return {
    node: hostNode,
    widget
  }
}
