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
      if (inputNode.isSubgraphNode()) {
        // ADR 0009: SubgraphNode is opaque, so target the child's input slot (even without a
        // backing widget) instead of resolving to a deeper leaf.
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
