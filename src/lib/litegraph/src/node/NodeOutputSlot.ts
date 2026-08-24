import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LinkId } from '@/lib/litegraph/src/LLink'
import { LabelPosition } from '@/lib/litegraph/src/draw'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  OptionalProps,
  Point
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createArrayMutationView } from '@/lib/litegraph/src/infrastructure/createMutationView'
import { NodeSlot } from '@/lib/litegraph/src/node/NodeSlot'
import type { IDrawOptions } from '@/lib/litegraph/src/node/NodeSlot'
import {
  outputHasLinks,
  outputLinkIds,
  outputLinks
} from '@/lib/litegraph/src/node/slotLinks'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import { isSubgraphOutput } from '@/lib/litegraph/src/subgraph/subgraphUtils'
import { warnDeprecated } from '@/lib/litegraph/src/utils/feedback'

export class NodeOutputSlot extends NodeSlot implements INodeOutputSlot {
  _data?: unknown
  slot_index?: number
  private readonly legacyLinkIds!: LinkId[]
  private readonly legacyLinksView!: LinkId[]
  private legacyLinksPresent!: boolean

  /**
   * @deprecated Reads return a stable store-derived view. Removing ids from the
   * view disconnects them; additions are discarded. First-party code uses the
   * slotLinks helpers and node topology methods.
   */
  get links(): LinkId[] | null {
    warnDeprecated(
      'output.links is deprecated. Read connectivity via node.isOutputConnected(slot) / node.getOutputNodes(slot); mutate via node.connect() / node.disconnectOutput().'
    )
    this.synchronizeLegacyLinks()
    return this.legacyLinksPresent ? this.legacyLinksView : null
  }

  set links(value: readonly LinkId[] | null) {
    warnDeprecated(
      'Assignment to output.links is deprecated; removals disconnect through the link store. Add links via node.connect().'
    )
    this.legacyLinksPresent = value !== null
    this.legacyLinkIds.splice(0, this.legacyLinkIds.length, ...(value ?? []))
    this.commitLegacyLinks()
  }

  private synchronizeLegacyLinks(preservePresence = false): void {
    const hadIds = this.legacyLinkIds.length > 0
    const ids = linkIdsOf(this)
    this.legacyLinkIds.splice(0, this.legacyLinkIds.length, ...ids)
    if (ids.length) this.legacyLinksPresent = true
    else if (hadIds && !preservePresence) this.legacyLinksPresent = false
  }

  private commitLegacyLinks(): void {
    const { graph } = this._node
    const slot = indexOf(this)
    if (!graph || slot === -1) {
      this.legacyLinkIds.splice(0)
      return
    }

    const desired = new Set(this.legacyLinkIds)
    for (const link of outputLinks(graph, this._node.id, slot)) {
      if (desired.has(link.id)) continue
      graph.getNodeById(link.target_id)?.disconnectInput(link.target_slot)
    }
    this.synchronizeLegacyLinks(true)
  }

  get isWidgetInputSlot(): false {
    return false
  }

  get collapsedPos(): Readonly<Point> {
    return [
      this._node._collapsed_width ?? LiteGraph.NODE_COLLAPSED_WIDTH,
      LiteGraph.NODE_TITLE_HEIGHT * -0.5
    ]
  }

  constructor(
    slot: OptionalProps<INodeOutputSlot, 'boundingRect'>,
    node: LGraphNode
  ) {
    // Serialized outputs carry a legacy links mirror; strip it so the base
    // ctor's Object.assign does not trip the deprecated setter above.
    const { links: _legacyLinks, ...rest } = slot
    super(rest, node)

    const legacyLinkIds: LinkId[] = []
    Object.defineProperties(this, {
      legacyLinkIds: { value: legacyLinkIds },
      legacyLinksView: {
        value: createArrayMutationView(
          legacyLinkIds,
          () => this.commitLegacyLinks(),
          () => this.synchronizeLegacyLinks()
        )
      },
      legacyLinksPresent: { value: false, writable: true }
    })

    this._data = slot._data
    this.slot_index = slot.slot_index
  }

  override isValidTarget(
    fromSlot: INodeInputSlot | INodeOutputSlot | SubgraphInput | SubgraphOutput
  ): boolean {
    if ('link' in fromSlot) {
      return LiteGraph.isValidConnection(this.type, fromSlot.type)
    }

    if (isSubgraphOutput(fromSlot)) {
      return LiteGraph.isValidConnection(this.type, fromSlot.type)
    }

    return false
  }

  override get isConnected(): boolean {
    const { graph } = this._node
    if (!graph) return false
    return outputHasLinks(graph, this._node.id, indexOf(this))
  }

  override draw(
    ctx: CanvasRenderingContext2D,
    options: Omit<IDrawOptions, 'doStroke' | 'labelPosition'>
  ) {
    const { textAlign, strokeStyle } = ctx
    ctx.textAlign = 'right'
    ctx.strokeStyle = 'black'

    super.draw(ctx, {
      ...options,
      labelPosition: LabelPosition.Left,
      doStroke: true
    })

    ctx.textAlign = textAlign
    ctx.strokeStyle = strokeStyle
  }

  override toJSON(): INodeOutputSlot {
    const ids = linkIdsOf(this)
    return {
      ...super.toJSON(),
      links: ids.length ? ids : null,
      slot_index: this.slot_index
    }
  }
}

/**
 * Module-local, not accessors: a getter-only property on the prototype would
 * collide with the base ctor's `Object.assign` for any serialized slot that
 * happens to carry the same key.
 */
function indexOf(slot: NodeOutputSlot): number {
  return slot.node.outputs.indexOf(slot)
}

function linkIdsOf(slot: NodeOutputSlot): LinkId[] {
  const { graph } = slot.node
  return graph ? outputLinkIds(graph, slot.node.id, indexOf(slot)) : []
}
