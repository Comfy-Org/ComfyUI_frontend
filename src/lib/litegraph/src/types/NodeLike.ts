import type { INodeInputSlot, INodeOutputSlot } from "@/interfaces"
import type { NodeId } from "@/LGraphNode"
import type { SubgraphIO } from "@/types/serialisation"

export interface NodeLike {
  id: NodeId

  canConnectTo(
    node: NodeLike,
    toSlot: INodeInputSlot | SubgraphIO,
    fromSlot: INodeOutputSlot | SubgraphIO,
  ): boolean
}
