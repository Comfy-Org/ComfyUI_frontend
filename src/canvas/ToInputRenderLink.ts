import type { RenderLink } from "./RenderLink"
import type { LinkNetwork, Point } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { INodeOutputSlot } from "@/litegraph"
import type { Reroute } from "@/Reroute"

import { LinkDirection } from "@/types/globalEnums"

/** Connecting TO an input slot. */

export class ToInputRenderLink implements RenderLink {
  readonly toType = "input"
  readonly fromPos: Point
  readonly fromSlotIndex: number
  fromDirection: LinkDirection = LinkDirection.RIGHT

  constructor(
    readonly network: LinkNetwork,
    readonly node: LGraphNode,
    readonly fromSlot: INodeOutputSlot,
    readonly fromReroute?: Reroute,
    public dragDirection: LinkDirection = LinkDirection.CENTER,
  ) {
    const outputIndex = node.outputs.indexOf(fromSlot)
    if (outputIndex === -1) throw new Error(`Creating render link for node [${this.node.id}] failed: Slot index not found.`)

    this.fromSlotIndex = outputIndex
    this.fromPos = fromReroute
      ? fromReroute.pos
      : this.node.getOutputPos(outputIndex)
  }
}
