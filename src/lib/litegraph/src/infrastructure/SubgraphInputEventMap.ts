import type {
  LGraphNode,
  SubgraphInput
} from '@comfyorg/graph-model/entityRegistry'

import type { INodeInputSlot } from '@comfyorg/graph-model/slots'

import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import type { LGraphEventMap } from '@comfyorg/graph-model/LGraphEventMap'

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
