import type { RenderLink } from "./RenderLink"
import type { CustomEventTarget } from "@/infrastructure/CustomEventTarget"
import type { LinkConnectorEventMap } from "@/infrastructure/LinkConnectorEventMap"
import type { INodeInputSlot, INodeOutputSlot, LinkNetwork, Point } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { Reroute } from "@/Reroute"
import type { SubgraphInput } from "@/subgraph/SubgraphInput"
import type { NodeLike } from "@/types/NodeLike"
import type { SubgraphIO } from "@/types/serialisation"

import { LinkDirection } from "@/types/globalEnums"

/** Connecting TO an output slot. */

export class ToOutputRenderLink implements RenderLink {
  readonly toType = "output"
  readonly fromPos: Point
  readonly fromSlotIndex: number
  fromDirection: LinkDirection = LinkDirection.LEFT

  constructor(
    readonly network: LinkNetwork,
    readonly node: LGraphNode,
    readonly fromSlot: INodeInputSlot,
    readonly fromReroute?: Reroute,
    public dragDirection: LinkDirection = LinkDirection.CENTER,
  ) {
    const inputIndex = node.inputs.indexOf(fromSlot)
    if (inputIndex === -1) throw new Error(`Creating render link for node [${this.node.id}] failed: Slot index not found.`)

    this.fromSlotIndex = inputIndex
    this.fromPos = fromReroute
      ? fromReroute.pos
      : this.node.getInputPos(inputIndex)
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
    const { node: inputNode, fromSlot, fromReroute } = this
    if (!inputNode) return

    const newLink = node.connectSlots(output, inputNode, fromSlot, fromReroute?.id)
    events.dispatch("link-created", newLink)
  }

  connectToSubgraphInput(input: SubgraphInput, events?: CustomEventTarget<LinkConnectorEventMap>): void {
    const newLink = input.connect(this.fromSlot, this.node, this.fromReroute?.id)
    events?.dispatch("link-created", newLink)
  }

  connectToRerouteOutput(
    reroute: Reroute,
    outputNode: LGraphNode,
    output: INodeOutputSlot,
    events: CustomEventTarget<LinkConnectorEventMap>,
  ): void {
    const { node: inputNode, fromSlot } = this
    const newLink = outputNode.connectSlots(output, inputNode, fromSlot, reroute?.id)
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
