import type {
  LGraphNode,
  SubgraphInput
} from '@/lib/litegraph/src/types/entityRegistry'

import type { INodeInputSlot } from '@/lib/litegraph/src/types/slots'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import type { LGraphEventMap } from './LGraphEventMap'

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
