import type { Positionable } from "@/interfaces"
import type { NodeId } from "@/LGraphNode"

import { SubgraphIONodeBase } from "./SubgraphIONodeBase"

export class SubgraphOutputNode extends SubgraphIONodeBase implements Positionable {
  readonly id: NodeId = -20

  get slots() {
    return this.subgraph.outputs
  }
}
