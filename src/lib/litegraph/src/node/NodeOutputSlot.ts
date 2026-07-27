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
import { NodeSlot } from '@/lib/litegraph/src/node/NodeSlot'
import type { IDrawOptions } from '@/lib/litegraph/src/node/NodeSlot'
import {
  outputHasLinks,
  outputLinkIds
} from '@/lib/litegraph/src/node/slotLinks'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import { isSubgraphOutput } from '@/lib/litegraph/src/subgraph/subgraphUtils'
import { warnDeprecated } from '@/lib/litegraph/src/utils/feedback'

export class NodeOutputSlot extends NodeSlot implements INodeOutputSlot {
  /** @deprecated Derived from the link store via a warning prototype getter; never written. */
  declare readonly links: readonly LinkId[] | null
  _data?: unknown
  slot_index?: number

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
    // ctor's Object.assign cannot collide with the deprecated prototype
    // getter (assigning a getter-only property throws in strict mode).
    const { links: _legacyLinks, ...rest } = slot
    super(rest, node)
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
    return outputHasLinks(
      graph,
      this._node.id,
      this._node.outputs.indexOf(this)
    )
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
    const { graph } = this._node
    const ids = graph
      ? outputLinkIds(graph, this._node.id, this._node.outputs.indexOf(this))
      : []
    return {
      ...super.toJSON(),
      links: ids.length ? ids : null,
      slot_index: this.slot_index
    }
  }
}

/**
 * Deprecation telemetry for extensions that still touch `output.links`.
 * Reads return a fresh store-derived array; writes fire telemetry and are
 * ignored, since the store cannot be mutated through the mirror.
 * First-party code uses the slotLinks helpers.
 */
Object.defineProperty(NodeOutputSlot.prototype, 'links', {
  get(this: NodeOutputSlot): readonly LinkId[] | null {
    warnDeprecated(
      'output.links is deprecated. Read connectivity via node.isOutputConnected(slot) / node.getOutputNodes(slot); enumerate links via outputLinks(graph, node.id, slot); mutate via node.connect() / node.disconnectOutput().'
    )
    const { graph } = this._node
    if (!graph) return null
    const ids = outputLinkIds(
      graph,
      this._node.id,
      this._node.outputs.indexOf(this)
    )
    return ids.length ? Object.freeze(ids) : null
  },
  set(this: NodeOutputSlot): void {
    warnDeprecated(
      'Assignment to output.links is deprecated and has no effect; connectivity is derived from the link store. Mutate via node.connect() / node.disconnectOutput().'
    )
  },
  configurable: true,
  enumerable: false
})
