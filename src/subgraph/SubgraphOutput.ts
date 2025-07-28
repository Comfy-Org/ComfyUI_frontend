import type { SubgraphOutputNode } from "./SubgraphOutputNode"
import type { INodeOutputSlot, Point, ReadOnlyRect } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { RerouteId } from "@/Reroute"

import { LLink } from "@/LLink"
import { NodeSlotType } from "@/types/globalEnums"
import { removeFromArray } from "@/utils/collections"

import { SubgraphSlot } from "./SubgraphSlotBase"

/**
 * An output "slot" from a subgraph to a parent graph.
 *
 * IMPORTANT: A subgraph "output" is both an output AND an input.  It creates an extra link connection point between
 * a parent graph and a subgraph, so is conceptually similar to a reroute.
 *
 * This can be a little confusing, but is easier to visualise when imagining editing a subgraph.
 * You have "Subgraph Outputs", because they go from inside the subgraph and out, but links to them come from "node outputs".
 *
 * Functionally, however, when editing a subgraph, that "subgraph output" is the "target" or "input side" of a link.
 */
export class SubgraphOutput extends SubgraphSlot {
  declare parent: SubgraphOutputNode

  override connect(slot: INodeOutputSlot, node: LGraphNode, afterRerouteId?: RerouteId): LLink | undefined {
    const { subgraph } = this.parent

    // Allow nodes to block connection
    const outputIndex = node.outputs.indexOf(slot)
    if (outputIndex === -1) throw new Error("Slot is not an output of the given node")

    if (node.onConnectOutput?.(outputIndex, this.type, this, this.parent, -1) === false) return

    // Link should not be present, but just in case, disconnect it
    const existingLink = this.getLinks().at(0)
    if (existingLink != null) {
      subgraph.beforeChange()

      existingLink.disconnect(subgraph, "input")
      const resolved = existingLink.resolve(subgraph)
      const links = resolved.output?.links
      if (links) removeFromArray(links, existingLink.id)
    }

    const link = new LLink(
      ++subgraph.state.lastLinkId,
      slot.type,
      node.id,
      outputIndex,
      this.parent.id,
      this.parent.slots.indexOf(this),
      afterRerouteId,
    )

    // Add to graph links list
    subgraph._links.set(link.id, link)

    // Set link ID in each slot
    this.linkIds[0] = link.id
    slot.links ??= []
    slot.links.push(link.id)

    // Reroutes
    const reroutes = LLink.getReroutes(subgraph, link)
    for (const reroute of reroutes) {
      reroute.linkIds.add(link.id)
      if (reroute.floating) delete reroute.floating
      reroute._dragging = undefined
    }

    // If this is the terminus of a floating link, remove it
    const lastReroute = reroutes.at(-1)
    if (lastReroute) {
      for (const linkId of lastReroute.floatingLinkIds) {
        const link = subgraph.floatingLinks.get(linkId)
        if (link?.parentId === lastReroute.id) {
          subgraph.removeFloatingLink(link)
        }
      }
    }
    subgraph._version++

    node.onConnectionsChange?.(
      NodeSlotType.OUTPUT,
      outputIndex,
      true,
      link,
      slot,
    )

    subgraph.afterChange()

    return link
  }

  get labelPos(): Point {
    const [x, y, , height] = this.boundingRect
    return [x + height, y + height * 0.5]
  }

  override arrange(rect: ReadOnlyRect): void {
    const [left, top, width, height] = rect
    const { boundingRect: b, pos } = this

    b[0] = left
    b[1] = top
    b[2] = width
    b[3] = height

    pos[0] = left + height * 0.5
    pos[1] = top + height * 0.5
  }
}
