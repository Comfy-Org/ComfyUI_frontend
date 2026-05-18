import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { isPromotedWidgetView } from './promotedWidgetTypes'
import { resolveSubgraphInputLink } from './resolveSubgraphInputLink'

type ResolvedSubgraphInputTarget = {
  nodeId: string
  widgetName: string
  sourceNodeId?: string
}

export function resolveSubgraphInputTarget(
  node: LGraphNode,
  inputName: string
): ResolvedSubgraphInputTarget | undefined {
  return resolveSubgraphInputLink(
    node,
    inputName,
    ({ inputNode, targetInput, getTargetWidget }) => {
      if (inputNode.isSubgraphNode()) {
        const targetWidget = getTargetWidget()
        if (!targetWidget) return undefined

        if (isPromotedWidgetView(targetWidget)) {
          return {
            nodeId: String(inputNode.id),
            widgetName: targetWidget.sourceWidgetName,
            sourceNodeId:
              targetWidget.disambiguatingSourceNodeId ??
              targetWidget.sourceNodeId
          }
        }

        return {
          nodeId: String(inputNode.id),
          widgetName: targetInput.name
        }
      }

      const targetWidget = getTargetWidget()
      if (!targetWidget) return undefined

      return {
        nodeId: String(inputNode.id),
        widgetName: targetWidget.name
      }
    }
  )
}
