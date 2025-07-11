import {
  type ExecutableLGraphNode,
  ExecutableNodeDTO,
  type ExecutionId,
  type LGraphNode,
  type NodeId,
  type SubgraphNode
} from '@comfyorg/litegraph'

import type { GroupNodeHandler } from '@/extensions/core/groupNode'

export class ExecutableGroupNodeChildDTO extends ExecutableNodeDTO {
  groupNodeHandler?: GroupNodeHandler

  constructor(
    /** The actual node that this DTO wraps. */
    node: LGraphNode | SubgraphNode,
    /** A list of subgraph instance node IDs from the root graph to the containing instance. @see {@link id} */
    subgraphNodePath: readonly NodeId[],
    /** A flattened map of all DTOs in this node network. Subgraph instances have been expanded into their inner nodes. */
    nodesByExecutionId: Map<ExecutionId, ExecutableLGraphNode>,
    /** The actual subgraph instance that contains this node, otherise undefined. */
    subgraphNode?: SubgraphNode | undefined,
    groupNodeHandler?: GroupNodeHandler
  ) {
    super(node, subgraphNodePath, nodesByExecutionId, subgraphNode)
    this.groupNodeHandler = groupNodeHandler
  }

  override resolveInput(slot: number) {
    const inputNode = this.node.getInputNode(slot)
    if (!inputNode) return

    const link = this.node.getInputLink(slot)
    if (!link) throw new Error('Failed to get input link')

    const id = String(inputNode.id).split(':').at(-1)
    if (id === undefined) throw new Error('Invalid input node id')

    const inputNodeDto = this.nodesByExecutionId?.get(id)
    if (!inputNodeDto) {
      throw new Error(
        `Failed to get input node ${id} for group node child ${this.id} with slot ${slot}`
      )
    }

    return {
      node: inputNodeDto,
      origin_id: String(inputNode.id),
      origin_slot: link.origin_slot
    }
  }
}
