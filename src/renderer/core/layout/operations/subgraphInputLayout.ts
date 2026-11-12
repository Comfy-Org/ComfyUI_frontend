import type { Subgraph } from '@comfyorg/graph-model/entityRegistry'
import type { BatchUpdateBoundsOperation } from '@/renderer/core/layout/types'

export function applySubgraphInputLayout(
  graph: Subgraph,
  operation: BatchUpdateBoundsOperation
): boolean {
  const node = graph.inputNode
  if (
    operation.graphId !== graph.id ||
    !operation.nodeIds.includes(node.id) ||
    !Object.hasOwn(operation.bounds, node.id)
  )
    return false
  const bounds = operation.bounds[node.id]
  node.configure({
    ...node.asSerialisable(),
    bounding: [bounds.x, bounds.y, bounds.width, bounds.height]
  })
  graph.setDirtyCanvas(true, true)
  return true
}
