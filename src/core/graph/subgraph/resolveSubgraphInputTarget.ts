import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
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
          nodeId: inputNode.id,
          widgetName: targetInput.name
        }
      }

      const targetWidget = getTargetWidget()
      if (!targetWidget) return undefined

      return {
        nodeId: inputNode.id,
        widgetName: targetWidget.name
      }
    }
  )
}

export function resolveSubgraphInputSourceNode(
  node: LGraphNode,
  inputName: string
): LGraphNode | undefined {
  if (!node.isSubgraphNode()) return undefined

  const visitedInputs = new WeakMap<LGraphNode, Set<string>>()
  let currentNode = node
  let currentInputName = inputName

  for (let depth = 0; depth < 100; depth++) {
    const visited = visitedInputs.get(currentNode) ?? new Set<string>()
    if (visited.has(currentInputName)) return undefined
    visited.add(currentInputName)
    visitedInputs.set(currentNode, visited)

    const target = resolveSubgraphInputLink(
      currentNode,
      currentInputName,
      ({ inputNode, targetInput }) => ({
        inputName: targetInput.name,
        node: inputNode
      })
    )
    if (!target) return undefined
    if (!target.node.isSubgraphNode()) return target.node

    currentNode = target.node
    currentInputName = target.inputName
  }

  return undefined
}
