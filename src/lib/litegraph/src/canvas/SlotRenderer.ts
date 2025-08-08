import { LabelPosition } from '@/lib/litegraph/src/draw'
import type {
  DefaultConnectionColors,
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type { ReadOnlyPoint } from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getCentre } from '@/lib/litegraph/src/measure'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import type { NodeSlot } from '@/lib/litegraph/src/node/NodeSlot'
import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'

export interface SlotDrawOptions {
  colorContext: DefaultConnectionColors
  labelPosition?: LabelPosition
  lowQuality?: boolean
  doStroke?: boolean
  highlight?: boolean
}

/** Draw a node input or output slot without coupling to the model class. */
export function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: NodeSlot,
  {
    colorContext,
    labelPosition = LabelPosition.Right,
    lowQuality = false,
    highlight = false,
    doStroke = false
  }: SlotDrawOptions
) {
  // Save the current fillStyle and strokeStyle
  const originalFillStyle = ctx.fillStyle
  const originalStrokeStyle = ctx.strokeStyle
  const originalLineWidth = ctx.lineWidth

  const labelColor = highlight ? slot.highlightColor : LiteGraph.NODE_TEXT_COLOR

  const nodePos = slot.node.pos
  const { boundingRect } = slot
  const diameter = boundingRect[3]
  const [cx, cy] = getCentre([
    boundingRect[0] - nodePos[0],
    boundingRect[1] - nodePos[1],
    diameter,
    diameter
  ])

  const slot_type = slot.type
  const slot_shape = (slot_type === 'array' ? RenderShape.GRID : slot.shape) as
    | RenderShape
    | undefined

  ctx.beginPath()
  let doFill = true

  ctx.fillStyle = slot.renderingColor(colorContext)
  ctx.lineWidth = 1
  if (slot_type === LiteGraph.EVENT || slot_shape === RenderShape.BOX) {
    ctx.rect(cx - 6 + 0.5, cy - 5 + 0.5, 14, 10)
  } else if (slot_shape === RenderShape.ARROW) {
    ctx.moveTo(cx + 8, cy + 0.5)
    ctx.lineTo(cx - 4, cy + 6 + 0.5)
    ctx.lineTo(cx - 4, cy - 6 + 0.5)
    ctx.closePath()
  } else if (slot_shape === RenderShape.GRID) {
    const gridSize = 3
    const cellSize = 2
    const spacing = 3

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        ctx.rect(cx - 4 + x * spacing, cy - 4 + y * spacing, cellSize, cellSize)
      }
    }
    doStroke = false
  } else {
    // Default rendering for circle, hollow circle.
    if (lowQuality) {
      ctx.rect(cx - 4, cy - 4, 8, 8)
    } else {
      let radius: number
      if (slot_shape === RenderShape.HollowCircle) {
        doFill = false
        doStroke = true
        ctx.lineWidth = 3
        ctx.strokeStyle = ctx.fillStyle
        radius = highlight ? 4 : 3
      } else {
        // Normal circle
        radius = highlight ? 5 : 4
      }
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    }
  }

  if (doFill) ctx.fill()
  if (!lowQuality && doStroke) ctx.stroke()

  // render slot label
  const hideLabel = lowQuality || slot.isWidgetInputSlot
  if (!hideLabel) {
    const text = slot.renderingLabel
    if (text) {
      ctx.fillStyle = labelColor
      if (labelPosition === LabelPosition.Right) {
        if (slot.dir == LiteGraph.UP) {
          ctx.fillText(text, cx, cy - 10)
        } else {
          ctx.fillText(text, cx + 10, cy + 5)
        }
      } else {
        if (slot.dir == LiteGraph.DOWN) {
          ctx.fillText(text, cx, cy - 8)
        } else {
          ctx.fillText(text, cx - 10, cy + 5)
        }
      }
    }
  }

  // Draw a red circle if the slot has errors.
  if (slot.hasErrors) {
    ctx.lineWidth = 2
    ctx.strokeStyle = 'red'
    ctx.beginPath()
    ctx.arc(cx, cy, 12, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Restore the original fillStyle and strokeStyle
  ctx.fillStyle = originalFillStyle
  ctx.strokeStyle = originalStrokeStyle
  ctx.lineWidth = originalLineWidth
}

/** Draw a minimal collapsed representation for the first connected slot. */
export function drawCollapsedSlot(
  ctx: CanvasRenderingContext2D,
  slot: INodeInputSlot | INodeOutputSlot,
  collapsedPos: ReadOnlyPoint
) {
  const x = collapsedPos[0]
  const y = collapsedPos[1]

  // Save original styles
  const { fillStyle } = ctx

  ctx.fillStyle = '#686'
  ctx.beginPath()

  if (slot.type === LiteGraph.EVENT || slot.shape === RenderShape.BOX) {
    ctx.rect(x - 7 + 0.5, y - 4, 14, 8)
  } else if (slot.shape === RenderShape.ARROW) {
    const isInput = slot instanceof NodeInputSlot
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
