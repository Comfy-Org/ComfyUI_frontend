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
        // ADR 0009: each SubgraphNode is opaque. The promoted target is the
        // child SubgraphNode's input slot, not a deeper leaf widget.
        // Resolve regardless of whether the inner slot has a backing widget,
        // so that link-only / non-widget inputs still surface the host
        // boundary contract (hostNodeLocator, subgraphInputName).
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
