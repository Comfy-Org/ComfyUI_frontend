import type { INodeInputSlot } from '@/lib/litegraph/src/litegraph'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import type { LGraphEventMap } from './LGraphEventMap'

export interface SubgraphInputEventMap extends LGraphEventMap {
  'input-connected': {
    input: INodeInputSlot
    widget: IBaseWidget
  }

  'input-disconnected': {
    input: SubgraphInput
  }
}
