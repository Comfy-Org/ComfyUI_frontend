import type { Positionable } from "@/interfaces"
import type { NodeId } from "@/LGraphNode"

import { SubgraphIONodeBase } from "./SubgraphIONodeBase"

export class SubgraphInputNode extends SubgraphIONodeBase implements Positionable {
  readonly id: NodeId = -10

  get slots() {
    return this.subgraph.inputs
  }
}
