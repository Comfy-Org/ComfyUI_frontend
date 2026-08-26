import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink, LinkId } from '@/lib/litegraph/src/LLink'
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
import { outputHasLinks, outputLinks } from '@/lib/litegraph/src/node/slotLinks'
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
   * view disconnects them; additions are ignored.
   */
  get links(): LinkId[] | null {
    warnDeprecated(
      'output.links is deprecated. Read connectivity via node.isOutputConnected(slot) / node.getOutputNodes(slot); mutate via node.connect() / node.disconnectOutput().'
    )
    this.synchronizeLegacyLinks()
    return this.legacyLinkIds.length || this.legacyLinksPresent
      ? this.legacyLinksView
      : null
  }

  set links(value: readonly LinkId[] | null) {
    warnDeprecated(
      'Assignment to output.links is deprecated; removals disconnect through the link store. Add links via node.connect().'
    )
    this.legacyLinksPresent = value !== null
    this.legacyLinkIds.splice(0, this.legacyLinkIds.length, ...(value ?? []))
    this.commitLegacyLinks()
  }

  private synchronizeLegacyLinks(): void {
    const ids = linkIdsOf(this)
    this.legacyLinkIds.splice(0, this.legacyLinkIds.length, ...ids)
  }

  _setLegacyLinksPresent(present: boolean): void {
    this.legacyLinksPresent = present
  }

  _serialiseLinkIds(ids: LinkId[]): LinkId[] | null {
    return ids.length || this.legacyLinksPresent ? ids : null
  }

  private commitLegacyLinks(): void {
    const { graph } = this._node
    const slot = indexOf(this)
    if (!graph || slot === -1) {
      this.legacyLinkIds.splice(0)
      return
    }

    const desired = new Set(this.legacyLinkIds)
    const current = outputLinks(graph, this._node.id, slot)
    for (const link of current) {
      if (desired.has(link.id)) continue
      graph.getNodeById(link.target_id)?.disconnectInput(link.target_slot)
    }
    this.synchronizeLegacyLinks()
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
    const { links: legacyLinks, ...rest } = slot
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
      legacyLinksPresent: {
        value: Array.isArray(legacyLinks),
        writable: true
      }
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
      links: this._serialiseLinkIds(ids),
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
  return linksOf(slot).map((link) => link.id)
}

function linksOf(slot: NodeOutputSlot): LLink[] {
  const { graph } = slot.node
  return graph ? outputLinks(graph, slot.node.id, indexOf(slot)) : []
}
