import type { CustomEventTarget } from "@/infrastructure/CustomEventTarget"
import type { LinkConnectorEventMap } from "@/infrastructure/LinkConnectorEventMap"
import type { INodeInputSlot, INodeOutputSlot, LinkNetwork, Point } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { LLink } from "@/LLink"
import type { Reroute } from "@/Reroute"
import type { SubgraphInput } from "@/subgraph/SubgraphInput"
import type { NodeLike } from "@/types/NodeLike"
import type { SubgraphIO } from "@/types/serialisation"

import { LinkDirection } from "@/types/globalEnums"

import { MovingLinkBase } from "./MovingLinkBase"

export class MovingOutputLink extends MovingLinkBase {
  override readonly toType = "output"

  readonly node: LGraphNode
  readonly fromSlot: INodeInputSlot
  readonly fromPos: Point
  readonly fromDirection: LinkDirection
  readonly fromSlotIndex: number

  constructor(network: LinkNetwork, link: LLink, fromReroute?: Reroute, dragDirection: LinkDirection = LinkDirection.CENTER) {
    super(network, link, "output", fromReroute, dragDirection)

    this.node = this.inputNode
    this.fromSlot = this.inputSlot
    this.fromPos = fromReroute?.pos ?? this.inputPos
    this.fromDirection = LinkDirection.LEFT
    this.fromSlotIndex = this.inputIndex
  }

  canConnectToInput(): false {
    return false
  }

  canConnectToOutput(outputNode: NodeLike, output: INodeOutputSlot | SubgraphIO): boolean {
    return outputNode.canConnectTo(this.node, this.inputSlot, output)
  }

  canConnectToReroute(reroute: Reroute): boolean {
    return reroute.origin_id !== this.outputNode.id
  }

  connectToInput(): never {
    throw new Error("MovingOutputLink cannot connect to an input.")
  }

  connectToOutput(outputNode: LGraphNode, output: INodeOutputSlot, events: CustomEventTarget<LinkConnectorEventMap>): LLink | null | undefined {
    if (output === this.outputSlot) return

    const link = outputNode.connectSlots(output, this.inputNode, this.inputSlot, this.link.parentId)
    if (link) events.dispatch("output-moved", this)
    return link
  }

  connectToSubgraphInput(input: SubgraphInput, events?: CustomEventTarget<LinkConnectorEventMap>): void {
    const newLink = input.connect(this.fromSlot, this.node, this.fromReroute?.id)
    events?.dispatch("link-created", newLink)
  }

  connectToSubgraphOutput(): void {
    throw new Error("MovingOutputLink cannot connect to a subgraph output.")
  }

  connectToRerouteInput(): never {
    throw new Error("MovingOutputLink cannot connect to an input.")
  }

  connectToRerouteOutput(
    reroute: Reroute,
    outputNode: LGraphNode,
    output: INodeOutputSlot,
    events: CustomEventTarget<LinkConnectorEventMap>,
  ): void {
    // Moving output side of links
    const { inputNode, inputSlot, fromReroute } = this

    // Creating a new link removes floating prop - check before connecting
    const floatingTerminus = reroute?.floating?.slotType === "output"

    // Connect the first reroute of the link being dragged to the reroute being dropped on
    if (fromReroute) {
      fromReroute.parentId = reroute.id
    } else {
      // If there are no reroutes, directly connect the link
      this.link.parentId = reroute.id
    }
    // Use the last reroute id on the link to retain all reroutes
    outputNode.connectSlots(output, inputNode, inputSlot, this.link.parentId)

    // Connecting from the final reroute of a floating reroute chain
    if (floatingTerminus) reroute.removeAllFloatingLinks()

    events.dispatch("output-moved", this)
  }

  disconnect(): boolean {
    return this.outputNode.disconnectOutput(this.outputIndex, this.inputNode)
  }
}
