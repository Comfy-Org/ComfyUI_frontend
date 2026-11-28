import type { SerializedNodeId } from '@comfyorg/graph-model/nodeId'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@comfyorg/graph-model/slots'
import type { SubgraphIO } from '@comfyorg/graph-model/serialisation'

export interface NodeLike {
  id: SerializedNodeId

  canConnectTo(
    node: NodeLike,
    toSlot: INodeInputSlot | SubgraphIO,
    fromSlot: INodeOutputSlot | SubgraphIO
  ): boolean
}
