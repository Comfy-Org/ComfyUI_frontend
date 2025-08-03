import type { CustomEventTarget } from "@/infrastructure/CustomEventTarget"
import type { LinkConnectorEventMap } from "@/infrastructure/LinkConnectorEventMap"
import type { INodeInputSlot, INodeOutputSlot, LinkNetwork, Point } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { LLink } from "@/LLink"
import type { Reroute } from "@/Reroute"
import type { SubgraphOutput } from "@/subgraph/SubgraphOutput"
import type { NodeLike } from "@/types/NodeLike"
import type { SubgraphIO } from "@/types/serialisation"

import { LinkDirection } from "@/types/globalEnums"

import { MovingLinkBase } from "./MovingLinkBase"

export class MovingInputLink extends MovingLinkBase {
  override readonly toType = "input"

  readonly node: LGraphNode
  readonly fromSlot: INodeOutputSlot
  readonly fromPos: Point
  readonly fromDirection: LinkDirection
  readonly fromSlotIndex: number

  constructor(network: LinkNetwork, link: LLink, fromReroute?: Reroute, dragDirection: LinkDirection = LinkDirection.CENTER) {
    super(network, link, "input", fromReroute, dragDirection)

    this.node = this.outputNode
    this.fromSlot = this.outputSlot
    this.fromPos = fromReroute?.pos ?? this.outputPos
    this.fromDirection = LinkDirection.NONE
    this.fromSlotIndex = this.outputIndex
  }

  canConnectToInput(inputNode: NodeLike, input: INodeInputSlot | SubgraphIO): boolean {
    return this.node.canConnectTo(inputNode, input, this.outputSlot)
  }

  canConnectToOutput(): false {
    return false
  }

  canConnectToReroute(reroute: Reroute): boolean {
    return reroute.origin_id !== this.inputNode.id
  }

  connectToInput(inputNode: LGraphNode, input: INodeInputSlot, events: CustomEventTarget<LinkConnectorEventMap>): LLink | null | undefined {
    if (input === this.inputSlot) return

    this.inputNode.disconnectInput(this.inputIndex, true)
    const link = this.outputNode.connectSlots(this.outputSlot, inputNode, input, this.fromReroute?.id)
    if (link) events.dispatch("input-moved", this)
    return link
  }

  connectToOutput(): never {
    throw new Error("MovingInputLink cannot connect to an output.")
  }

  connectToSubgraphInput(): void {
    throw new Error("MovingInputLink cannot connect to a subgraph input.")
  }

  connectToSubgraphOutput(output: SubgraphOutput, events?: CustomEventTarget<LinkConnectorEventMap>): void {
    const newLink = output.connect(this.fromSlot, this.node, this.fromReroute?.id)
    events?.dispatch("link-created", newLink)
  }

  connectToRerouteInput(
    reroute: Reroute,
    { node: inputNode, input, link: existingLink }: { node: LGraphNode, input: INodeInputSlot, link: LLink },
    events: CustomEventTarget<LinkConnectorEventMap>,
    originalReroutes: Reroute[],
  ): void {
    const { outputNode, outputSlot, fromReroute } = this

    // Clean up reroutes
    for (const reroute of originalReroutes) {
      if (reroute.id === this.link.parentId) break

      if (reroute.totalLinks === 1) reroute.remove()
    }
    // Set the parentId of the reroute we dropped on, to the reroute we dragged from
    reroute.parentId = fromReroute?.id

    const newLink = outputNode.connectSlots(outputSlot, inputNode, input, existingLink.parentId)
    if (newLink) events.dispatch("input-moved", this)
  }

  connectToRerouteOutput(): never {
    throw new Error("MovingInputLink cannot connect to an output.")
  }

  disconnect(): boolean {
    return this.inputNode.disconnectInput(this.inputIndex, true)
  }
}
