import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@comfyorg/graph-model/entityRegistry'

export const isSubgraph = (
  item: LGraph | Subgraph | undefined | null
): item is Subgraph => item?.isRootGraph === false

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
