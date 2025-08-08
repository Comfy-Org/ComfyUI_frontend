import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LinkId } from '@/lib/litegraph/src/LLink'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  OptionalProps,
  ReadOnlyPoint
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { NodeSlot } from '@/lib/litegraph/src/node/NodeSlot'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import { isSubgraphInput } from '@/lib/litegraph/src/subgraph/subgraphUtils'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export class NodeInputSlot extends NodeSlot implements INodeInputSlot {
  link: LinkId | null

  get isWidgetInputSlot(): boolean {
    return !!this.widget
  }

  #widget: WeakRef<IBaseWidget> | undefined

  /** Internal use only; API is not finalised and may change at any time. */
  get _widget(): IBaseWidget | undefined {
    return this.#widget?.deref()
  }

  set _widget(widget: IBaseWidget | undefined) {
    this.#widget = widget ? new WeakRef(widget) : undefined
  }

  get collapsedPos(): ReadOnlyPoint {
    return [0, LiteGraph.NODE_TITLE_HEIGHT * -0.5]
  }

  constructor(
    slot: OptionalProps<INodeInputSlot, 'boundingRect'>,
    node: LGraphNode
  ) {
    super(slot, node)
    this.link = slot.link
  }

  override get isConnected(): boolean {
    return this.link != null
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
}
