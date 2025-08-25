import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LabelPosition, SlotShape, SlotType } from '@/lib/litegraph/src/draw'
import type {
  CanvasColour,
  DefaultConnectionColors,
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot,
  ISubgraphInput,
  OptionalProps,
  Point,
  ReadOnlyPoint
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph, Rectangle } from '@/lib/litegraph/src/litegraph'
import { getCentre } from '@/lib/litegraph/src/measure'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import {
  LinkDirection,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'

import { NodeInputSlot } from './NodeInputSlot'
import { SlotBase } from './SlotBase'

export interface IDrawOptions {
  colorContext: DefaultConnectionColors
  labelPosition?: LabelPosition
  lowQuality?: boolean
  doStroke?: boolean
  highlight?: boolean
}

/** Shared base class for {@link LGraphNode} input and output slots. */
export abstract class NodeSlot extends SlotBase implements INodeSlot {
  pos?: Point

  /** The offset from the parent node to the centre point of this slot. */
  get #centreOffset(): ReadOnlyPoint {
    const nodePos = this.node.pos
    const { boundingRect } = this

    // Use height; widget input slots may be thinner.
    const diameter = boundingRect[3]

    return getCentre([
      boundingRect[0] - nodePos[0],
      boundingRect[1] - nodePos[1],
      diameter,
      diameter
    ])
  }

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
    // Workaround: Ensure internal properties are not copied to the slot (_listenerController
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

  draw(
    ctx: CanvasRenderingContext2D,
    {
      colorContext,
      labelPosition = LabelPosition.Right,
      lowQuality = false,
      highlight = false,
      doStroke = false
    }: IDrawOptions
  ) {
    // Save the current fillStyle and strokeStyle
    const originalFillStyle = ctx.fillStyle
    const originalStrokeStyle = ctx.strokeStyle
    const originalLineWidth = ctx.lineWidth

    const labelColor = highlight
      ? this.highlightColor
      : LiteGraph.NODE_TEXT_COLOR

    const pos = this.#centreOffset
    const slot_type = this.type
    const slot_shape = (
      slot_type === SlotType.Array ? SlotShape.Grid : this.shape
    ) as SlotShape

    ctx.beginPath()
    let doFill = true

    ctx.fillStyle = this.renderingColor(colorContext)
    ctx.lineWidth = 1
    if (slot_type === SlotType.Event || slot_shape === SlotShape.Box) {
      ctx.rect(pos[0] - 6 + 0.5, pos[1] - 5 + 0.5, 14, 10)
    } else if (slot_shape === SlotShape.Arrow) {
      ctx.moveTo(pos[0] + 8, pos[1] + 0.5)
      ctx.lineTo(pos[0] - 4, pos[1] + 6 + 0.5)
      ctx.lineTo(pos[0] - 4, pos[1] - 6 + 0.5)
      ctx.closePath()
    } else if (slot_shape === SlotShape.Grid) {
      const gridSize = 3
      const cellSize = 2
      const spacing = 3

      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          ctx.rect(
            pos[0] - 4 + x * spacing,
            pos[1] - 4 + y * spacing,
            cellSize,
            cellSize
          )
        }
      }
      doStroke = false
    } else {
      // Default rendering for circle, hollow circle.
      if (lowQuality) {
        ctx.rect(pos[0] - 4, pos[1] - 4, 8, 8)
      } else {
        let radius: number
        if (slot_shape === SlotShape.HollowCircle) {
          doFill = false
          doStroke = true
          ctx.lineWidth = 3
          ctx.strokeStyle = ctx.fillStyle
          radius = highlight ? 4 : 3
        } else {
          // Normal circle
          radius = highlight ? 5 : 4
        }
        ctx.arc(pos[0], pos[1], radius, 0, Math.PI * 2)
      }
    }

    if (doFill) ctx.fill()
    if (!lowQuality && doStroke) ctx.stroke()

    // render slot label
    const hideLabel = lowQuality || this.isWidgetInputSlot
    if (!hideLabel) {
      const text = this.renderingLabel
      if (text) {
        // TODO: Finish impl.  Highlight text on mouseover unless we're connecting links.
        ctx.fillStyle = labelColor

        if (labelPosition === LabelPosition.Right) {
          if (this.dir == LinkDirection.UP) {
            ctx.fillText(text, pos[0], pos[1] - 10)
          } else {
            ctx.fillText(text, pos[0] + 10, pos[1] + 5)
          }
        } else {
          if (this.dir == LinkDirection.DOWN) {
            ctx.fillText(text, pos[0], pos[1] - 8)
          } else {
            ctx.fillText(text, pos[0] - 10, pos[1] + 5)
          }
        }
      }
    }

    // Draw a red circle if the slot has errors.
    if (this.hasErrors) {
      ctx.lineWidth = 2
      ctx.strokeStyle = 'red'
      ctx.beginPath()
      ctx.arc(pos[0], pos[1], 12, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Restore the original fillStyle and strokeStyle
    ctx.fillStyle = originalFillStyle
    ctx.strokeStyle = originalStrokeStyle
    ctx.lineWidth = originalLineWidth
  }

  drawCollapsed(ctx: CanvasRenderingContext2D) {
    const [x, y] = this.collapsedPos

    // Save original styles
    const { fillStyle } = ctx

    ctx.fillStyle = '#686'
    ctx.beginPath()

    if (this.type === SlotType.Event || this.shape === RenderShape.BOX) {
      ctx.rect(x - 7 + 0.5, y - 4, 14, 8)
    } else if (this.shape === RenderShape.ARROW) {
      // Adjust arrow direction based on whether this is an input or output slot
      const isInput = this instanceof NodeInputSlot
      if (isInput) {
        ctx.moveTo(x + 8, y)
        ctx.lineTo(x - 4, y - 4)
        ctx.lineTo(x - 4, y + 4)
      } else {
        ctx.moveTo(x + 6, y)
        ctx.lineTo(x - 6, y - 4)
        ctx.lineTo(x - 6, y + 4)
      }
      ctx.closePath()
    } else {
      ctx.arc(x, y, 4, 0, Math.PI * 2)
    }
    ctx.fill()

    // Restore original styles
    ctx.fillStyle = fillStyle
  }
}
