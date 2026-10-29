import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'

export const isSubgraphIoNode = (
  node: Omit<LGraphNode, 'constructor'> & {
    constructor?: LGraphNode['constructor']
  }
): node is LGraphNode & {
  constructor: { comfyClass: 'SubgraphInputNode' | 'SubgraphOutputNode' }
} => {
  const nodeClass = node.constructor?.comfyClass
  return nodeClass === 'SubgraphInputNode' || nodeClass === 'SubgraphOutputNode'
}
