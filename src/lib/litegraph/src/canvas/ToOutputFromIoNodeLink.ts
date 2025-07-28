import type { RenderLink } from "./RenderLink"
import type { CustomEventTarget } from "@/infrastructure/CustomEventTarget"
import type { LinkConnectorEventMap } from "@/infrastructure/LinkConnectorEventMap"
import type { INodeOutputSlot, LinkNetwork, Point } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { Reroute } from "@/Reroute"
import type { SubgraphOutput } from "@/subgraph/SubgraphOutput"
import type { SubgraphOutputNode } from "@/subgraph/SubgraphOutputNode"
import type { NodeLike } from "@/types/NodeLike"
import type { SubgraphIO } from "@/types/serialisation"

import { LinkDirection } from "@/types/globalEnums"

/** Connecting TO an output slot. */

export class ToOutputFromIoNodeLink implements RenderLink {
  readonly toType = "output"
  readonly fromPos: Point
  readonly fromSlotIndex: number
  fromDirection: LinkDirection = LinkDirection.LEFT

  constructor(
    readonly network: LinkNetwork,
    readonly node: SubgraphOutputNode,
    readonly fromSlot: SubgraphOutput,
    readonly fromReroute?: Reroute,
    public dragDirection: LinkDirection = LinkDirection.CENTER,
  ) {
    const inputIndex = node.slots.indexOf(fromSlot)
    if (inputIndex === -1 && fromSlot !== node.emptySlot) {
      throw new Error(`Creating render link for node [${this.node.id}] failed: Slot index not found.`)
    }

    this.fromSlotIndex = inputIndex
    this.fromPos = fromReroute
      ? fromReroute.pos
      : fromSlot.pos
  }

  canConnectToInput(): false {
    return false
  }

  canConnectToOutput(outputNode: NodeLike, output: INodeOutputSlot | SubgraphIO): boolean {
    return this.node.canConnectTo(outputNode, this.fromSlot, output)
  }

  canConnectToReroute(reroute: Reroute): boolean {
    if (reroute.origin_id === this.node.id) return false
    return true
  }

  connectToOutput(node: LGraphNode, output: INodeOutputSlot, events: CustomEventTarget<LinkConnectorEventMap>) {
    const { fromSlot, fromReroute } = this

    const newLink = fromSlot.connect(output, node, fromReroute?.id)
    events.dispatch("link-created", newLink)
  }

  connectToSubgraphInput(): void {
    throw new Error("Not implemented")
  }

  connectToRerouteOutput(
    reroute: Reroute,
    outputNode: LGraphNode,
    output: INodeOutputSlot,
    events: CustomEventTarget<LinkConnectorEventMap>,
  ): void {
    const { fromSlot } = this

    const newLink = fromSlot.connect(output, outputNode, reroute?.id)
    events.dispatch("link-created", newLink)
  }

  connectToInput() {
    throw new Error("ToOutputRenderLink cannot connect to an input.")
  }

  connectToSubgraphOutput(): void {
    throw new Error("ToOutputRenderLink cannot connect to a subgraph output.")
  }

  connectToRerouteInput() {
    throw new Error("ToOutputRenderLink cannot connect to an input.")
  }
}
