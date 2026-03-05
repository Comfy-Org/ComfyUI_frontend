import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { RerouteId } from '@/lib/litegraph/src/Reroute'
import { graphLifecycleEventDispatcher } from '@/lib/litegraph/src/infrastructure/GraphLifecycleEventDispatcher'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  Point,
  ReadOnlyRect
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { warnDeprecated } from '@/lib/litegraph/src/utils/feedback'

import type { SubgraphInput } from './SubgraphInput'
import type { SubgraphOutputNode } from './SubgraphOutputNode'
import { SubgraphSlot } from './SubgraphSlotBase'
import { isNodeSlot, isSubgraphInput } from './subgraphUtils'

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

  override connect(
    slot: INodeOutputSlot,
    node: LGraphNode,
    afterRerouteId?: RerouteId
  ): LLink | undefined {
    const { subgraph } = this.parent

    // Validate type compatibility
    if (!LiteGraph.isValidConnection(slot.type, this.type)) return

    // Allow nodes to block connection
    const outputIndex = node.outputs.indexOf(slot)
    if (outputIndex === -1)
      throw new Error('Slot is not an output of the given node')

    if (
      node.onConnectOutput?.(outputIndex, this.type, this, this.parent, -1) ===
      false
    )
      return

    subgraph.beforeChange()
    try {
      // Link should not be present, but just in case, disconnect it
      const existingLink = this.getLinks().at(0)
      if (existingLink != null) {
        const { outputNode } = existingLink.resolve(subgraph)
        if (!outputNode)
          throw new Error('Expected output node for existing link')

        subgraph.disconnectSubgraphOutputLink(
          this,
          outputNode,
          existingLink.origin_slot,
          existingLink
        )

        graphLifecycleEventDispatcher.dispatchNodeConnectionChange({
          node: outputNode,
          slotType: NodeSlotType.OUTPUT,
          slotIndex: existingLink.origin_slot,
          connected: false,
          link: existingLink,
          slot: this
        })
      }

      const link = subgraph.connectSubgraphOutputSlot(
        node,
        outputIndex,
        this,
        afterRerouteId
      )
      if (!link) return

      graphLifecycleEventDispatcher.dispatchNodeConnectionChange({
        node,
        slotType: NodeSlotType.OUTPUT,
        slotIndex: outputIndex,
        connected: true,
        link,
        slot
      })

      return link
    } finally {
      subgraph.afterChange()
    }
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

  /**
   * Checks if this slot is a valid target for a connection from the given slot.
   * For SubgraphOutput (which acts as an input inside the subgraph),
   * the fromSlot should be an output slot.
   */
  override isValidTarget(
    fromSlot: INodeInputSlot | INodeOutputSlot | SubgraphInput | SubgraphOutput
  ): boolean {
    if (isNodeSlot(fromSlot)) {
      return (
        'links' in fromSlot &&
        LiteGraph.isValidConnection(fromSlot.type, this.type)
      )
    }

    if (isSubgraphInput(fromSlot)) {
      return LiteGraph.isValidConnection(fromSlot.type, this.type)
    }

    return false
  }
  private static _disconnectDeprecationWarned = false

  override disconnect() {
    const { subgraph } = this.parent
    if (!SubgraphOutput._disconnectDeprecationWarned) {
      SubgraphOutput._disconnectDeprecationWarned = true
      warnDeprecated(
        '[DEPRECATED] SubgraphOutput.disconnect now dispatches onConnectionsChange for output-node disconnect parity. Remedy: update extension handlers to treat OUTPUT/disconnected callbacks as the canonical disconnect signal and no-op safely if already detached.'
      )
    }

    //should never have more than one connection
    for (const linkId of [...this.linkIds]) {
      const link = subgraph.links.get(linkId)
      if (!link) continue

      const { outputNode } = link.resolve(subgraph)
      if (!outputNode) continue

      subgraph.disconnectSubgraphOutputLink(
        this,
        outputNode,
        link.origin_slot,
        link
      )

      graphLifecycleEventDispatcher.dispatchNodeConnectionChange({
        node: outputNode,
        slotType: NodeSlotType.OUTPUT,
        slotIndex: link.origin_slot,
        connected: false,
        link,
        slot: this
      })
    }

    this.linkIds.length = 0
  }
}
