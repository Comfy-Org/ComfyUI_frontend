import type { RenderLink } from "./RenderLink"
import type { LinkNetwork, Point } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { INodeInputSlot } from "@/litegraph"
import type { Reroute } from "@/Reroute"

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
      : this.node.getConnectionPos(true, inputIndex)
  }
}
