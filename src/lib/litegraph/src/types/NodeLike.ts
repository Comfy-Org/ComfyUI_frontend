import type { SerializedNodeId } from '@comfyorg/graph-model/nodeId'
import type { SubgraphIO } from '@comfyorg/graph-model/serialisation'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@comfyorg/graph-model/slots'

export interface NodeLike {
  id: SerializedNodeId

  canConnectTo(
    node: NodeLike,
    toSlot: INodeInputSlot | SubgraphIO,
    fromSlot: INodeOutputSlot | SubgraphIO
  ): boolean
}
