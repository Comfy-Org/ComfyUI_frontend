import type {
  LGraphNode,
  LLink,
  SubgraphOutputNode
} from '@comfyorg/graph-model/entityRegistry'

import type { RerouteId } from '@comfyorg/graph-model/rerouteId'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { INodeOutputSlot } from '@comfyorg/graph-model/slots'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import { zeroUuid } from '@/utils/uuid'

import { SubgraphOutput } from './SubgraphOutput'

/**
 * A virtual slot that simply creates a new output slot when connected to.
 */
export class EmptySubgraphOutput extends SubgraphOutput {
  declare parent: SubgraphOutputNode

  constructor(parent: SubgraphOutputNode) {
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
    slot: INodeOutputSlot,
    node: LGraphNode,
    afterRerouteId?: RerouteId
  ): LLink | undefined {
    const { subgraph } = this.parent
    const existingNames = subgraph.outputs.map((x) => x.name)

    const name = nextUniqueName(slot.name, existingNames)
    const output = subgraph.addOutput(name, String(slot.type))
    return output.connect(slot, node, afterRerouteId)
  }

  override get labelPos(): Point {
    const [x, y, , height] = this.boundingRect
    return [x, y + height * 0.5]
  }
}
