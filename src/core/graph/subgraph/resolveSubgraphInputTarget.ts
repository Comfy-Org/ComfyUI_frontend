import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { resolveSubgraphInputLink } from './resolveSubgraphInputLink'

type ResolvedSubgraphInputTarget = {
  nodeId: string
  widgetName: string
}

export function resolveSubgraphInputTarget(
  node: LGraphNode,
  inputName: string
): ResolvedSubgraphInputTarget | undefined {
  return resolveSubgraphInputLink(
    node,
    inputName,
    ({ inputNode, targetInput, getTargetWidget }) => {
      const targetWidget = getTargetWidget()
      if (!targetWidget) return undefined

      if (inputNode.isSubgraphNode()) {
        // ADR 0009: each SubgraphNode is opaque. The promoted target is the
        // child SubgraphNode's input slot, not a deeper leaf widget.
        return {
          nodeId: String(inputNode.id),
          widgetName: targetInput.name
        }
      }

      return {
        nodeId: String(inputNode.id),
        widgetName: targetWidget.name
      }
    }
  )
}
