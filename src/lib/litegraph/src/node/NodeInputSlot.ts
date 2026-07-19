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
import { inputHasLink, inputLinkId } from '@/lib/litegraph/src/node/slotLinks'
import { warnDeprecated } from '@/lib/litegraph/src/utils/feedback'
import type { IDrawOptions } from '@/lib/litegraph/src/node/NodeSlot'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import { isSubgraphInput } from '@/lib/litegraph/src/subgraph/subgraphUtils'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export class NodeInputSlot extends NodeSlot implements INodeInputSlot {
  /** @deprecated Derived from the link store via a warning prototype getter; never written. */
  declare readonly link: LinkId | null
  alwaysVisible?: boolean

  get isWidgetInputSlot(): boolean {
    return !!this.widget
  }

  private _widgetRef: WeakRef<IBaseWidget> | undefined

  /** Internal use only; API is not finalised and may change at any time. */
  get _widget(): IBaseWidget | undefined {
    return this._widgetRef?.deref()
  }

  set _widget(widget: IBaseWidget | undefined) {
    this._widgetRef = widget ? new WeakRef(widget) : undefined
  }

  get collapsedPos(): Readonly<Point> {
    return [0, LiteGraph.NODE_TITLE_HEIGHT * -0.5]
  }

  constructor(
    slot: OptionalProps<INodeInputSlot, 'boundingRect'>,
    node: LGraphNode
  ) {
    // Serialized inputs carry a legacy link mirror; strip it so the base
    // ctor's Object.assign cannot collide with the deprecated prototype
    // getter (assigning a getter-only property throws in strict mode).
    const { link: _legacyLink, ...rest } = slot
    super(rest, node)
  }

  override get isConnected(): boolean {
    const { graph } = this._node
    if (!graph) return false
    return inputHasLink(graph, this._node.id, this._node.inputs.indexOf(this))
  }

  override isValidTarget(
    fromSlot: INodeInputSlot | INodeOutputSlot | SubgraphInput | SubgraphOutput
  ): boolean {
    if ('links' in fromSlot) {
      return LiteGraph.isValidConnection(fromSlot.type, this.type)
    }

    if (isSubgraphInput(fromSlot)) {
      return LiteGraph.isValidConnection(fromSlot.type, this.type)
    }

    return false
  }

  override draw(
    ctx: CanvasRenderingContext2D,
    options: Omit<IDrawOptions, 'doStroke' | 'labelPosition'>
  ) {
    const { textAlign } = ctx
    ctx.textAlign = 'left'

    super.draw(ctx, {
      ...options,
      labelPosition: LabelPosition.Right,
      doStroke: false
    })

    ctx.textAlign = textAlign
  }

  override toJSON(): INodeInputSlot {
    const { graph } = this._node
    return {
      ...super.toJSON(),
      link: graph
        ? (inputLinkId(graph, this._node.id, this._node.inputs.indexOf(this)) ??
          null)
        : null,
      widget: this.widget
    }
  }
}

/**
 * Deprecation telemetry for extensions that still touch `input.link`.
 * Reads return the store-derived link id; writes fire telemetry and are
 * ignored, since the store cannot be mutated through the mirror.
 * First-party code uses the slotLinks helpers.
 */
Object.defineProperty(NodeInputSlot.prototype, 'link', {
  get(this: NodeInputSlot): LinkId | null {
    warnDeprecated(
      'input.link is deprecated. Read connectivity via node.isInputConnected(slot) / node.getInputLink(slot); mutate via node.connect() / node.disconnectInput().'
    )
    const { graph } = this._node
    if (!graph) return null
    return (
      inputLinkId(graph, this._node.id, this._node.inputs.indexOf(this)) ?? null
    )
  },
  set(this: NodeInputSlot): void {
    warnDeprecated(
      'Assignment to input.link is deprecated and has no effect; connectivity is derived from the link store. Mutate via node.connect() / node.disconnectInput().'
    )
  },
  configurable: true,
  enumerable: false
})
