import type {
  LGraphNode,
  LLink,
  SubgraphInputNode
} from '@comfyorg/graph-model/entityRegistry'

import type { RerouteId } from '@comfyorg/graph-model/rerouteId'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import { zeroUuid } from '@comfyorg/graph-model/uuid'

import { SubgraphInput } from './SubgraphInput'

/**
 * A virtual slot that simply creates a new input slot when connected to.
 */
export class EmptySubgraphInput extends SubgraphInput {
  declare parent: SubgraphInputNode

  constructor(parent: SubgraphInputNode) {
    super(
      {
        id: zeroUuid,
        name: '',
        type: ''
      },
      parent
    )
  }

  override connect(
    slot: INodeInputSlot,
    node: LGraphNode,
    afterRerouteId?: RerouteId
  ): LLink | undefined {
    const { subgraph } = this.parent
    const existingNames = subgraph.inputs.map((x) => x.name)

    const name = nextUniqueName(slot.name, existingNames)
    const input = subgraph.addInput(name, String(slot.type))
    return input.connect(slot, node, afterRerouteId)
  }

  override get labelPos(): Point {
    const [x, y, , height] = this.boundingRect
    return [x, y + height * 0.5]
  }
}
