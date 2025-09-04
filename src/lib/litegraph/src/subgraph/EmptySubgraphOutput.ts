import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LLink } from '@/lib/litegraph/src/LLink'
import type { RerouteId } from '@/lib/litegraph/src/Reroute'
import type { INodeOutputSlot, Point } from '@/lib/litegraph/src/interfaces'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import { zeroUuid } from '@/lib/litegraph/src/utils/uuid'

import { SubgraphOutput } from './SubgraphOutput'
import type { SubgraphOutputNode } from './SubgraphOutputNode'
import { isSubgraphOutputNode } from './subgraphUtils'

/**
 * A virtual slot that simply creates a new output slot when connected to.
 */
export class EmptySubgraphOutput extends SubgraphOutput {
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
    if (!isSubgraphOutputNode(this.parent)) {
      console.error('Invalid parent type for EmptySubgraphOutput')
      return
    }
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
