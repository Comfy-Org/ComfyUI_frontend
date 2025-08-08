import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  CanvasColour,
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot,
  ISubgraphInput,
  OptionalProps,
  Point,
  ReadOnlyPoint
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph, Rectangle } from '@/lib/litegraph/src/litegraph'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'

import { SlotBase } from './SlotBase'

/** Shared base class for {@link LGraphNode} input and output slots. */
export abstract class NodeSlot extends SlotBase implements INodeSlot {
  pos?: Point

  /** The center point of this slot when the node is collapsed. */
  abstract get collapsedPos(): ReadOnlyPoint

  #node: LGraphNode
  get node(): LGraphNode {
    return this.#node
  }

  get highlightColor(): CanvasColour {
    return (
      LiteGraph.NODE_TEXT_HIGHLIGHT_COLOR ??
      LiteGraph.NODE_SELECTED_TITLE_COLOR ??
      LiteGraph.NODE_TEXT_COLOR
    )
  }

  abstract get isWidgetInputSlot(): boolean

  constructor(
    slot: OptionalProps<INodeSlot, 'boundingRect'>,
    node: LGraphNode
  ) {
    // @ts-expect-error Workaround: Ensure internal properties are not copied to the slot (_listenerController
    // https://github.com/Comfy-Org/litegraph.js/issues/1138
    const maybeSubgraphSlot: OptionalProps<
      ISubgraphInput,
      'link' | 'boundingRect'
    > = slot
    const { boundingRect, name, type, _listenerController, ...rest } =
      maybeSubgraphSlot
    const rectangle = boundingRect
      ? Rectangle.ensureRect(boundingRect)
      : new Rectangle()

    super(name, type, rectangle)

    Object.assign(this, rest)
    this.#node = node
  }

  /**
   * Whether this slot is a valid target for a dragging link.
   * @param fromSlot The slot that the link is being connected from.
   */
  abstract isValidTarget(
    fromSlot: INodeInputSlot | INodeOutputSlot | SubgraphInput | SubgraphOutput
  ): boolean

  /**
   * The label to display in the UI.
   */
  get renderingLabel(): string {
    return this.label || this.localized_name || this.name || ''
  }
}
