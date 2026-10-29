import type {
  LGraphNode,
  SubgraphInput
} from '@comfyorg/graph-model/entityRegistry'
import type { LGraphEventMap } from '@comfyorg/graph-model/LGraphEventMap'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

export interface SubgraphInputEventMap extends LGraphEventMap {
  'input-connected': {
    input: INodeInputSlot
    widget?: IBaseWidget
    node?: LGraphNode
  }

  'input-disconnected': {
    input: SubgraphInput
  }
}
