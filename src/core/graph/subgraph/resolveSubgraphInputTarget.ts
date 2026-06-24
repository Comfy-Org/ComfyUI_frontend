import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { nodeId as toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import { resolveSubgraphInputLink } from './resolveSubgraphInputLink'

type ResolvedSubgraphInputTarget = {
  nodeId: NodeId
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
        return {
          nodeId: toNodeId(inputNode.id),
          widgetName: targetInput.name
        }
      }

      const targetWidget = getTargetWidget()
      if (!targetWidget) return undefined

      return {
        nodeId: toNodeId(inputNode.id),
        widgetName: targetWidget.name
      }
    }
  )
}
