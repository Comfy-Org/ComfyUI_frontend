import { LiteGraph, type Vector2 } from "./litegraph"
import type { CanvasColour, INodeSlot, Rect } from "./interfaces"
import { LinkDirection, RenderShape, TitleMode } from "./types/globalEnums"

export enum SlotType {
  Array = "array",
  Event = -1,
}

/** @see RenderShape */
export enum SlotShape {
  Box = RenderShape.BOX,
  Arrow = RenderShape.ARROW,
  Grid = RenderShape.GRID,
  Circle = RenderShape.CIRCLE,
  HollowCircle = RenderShape.HollowCircle,
}

/** @see LinkDirection */
export enum SlotDirection {
  Up = LinkDirection.UP,
  Right = LinkDirection.RIGHT,
  Down = LinkDirection.DOWN,
  Left = LinkDirection.LEFT,
}

export enum LabelPosition {
  Left = "left",
  Right = "right",
}

export function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: Partial<INodeSlot>,
  pos: Vector2,
  {
    label_color = "#AAA",
    label_position = LabelPosition.Right,
    horizontal = false,
    low_quality = false,
    render_text = true,
    do_stroke = false,
    highlight = false,
  }: {
    label_color?: string
    label_position?: LabelPosition
    horizontal?: boolean
    low_quality?: boolean
    render_text?: boolean
    do_stroke?: boolean
    highlight?: boolean
  } = {},
) {
  // Save the current fillStyle and strokeStyle
  const originalFillStyle = ctx.fillStyle
  const originalStrokeStyle = ctx.strokeStyle
  const originalLineWidth = ctx.lineWidth

  const slot_type = slot.type as SlotType
  const slot_shape = (
    slot_type === SlotType.Array ? SlotShape.Grid : slot.shape
  ) as SlotShape

  ctx.beginPath()
  let doStroke = do_stroke
  let doFill = true

  if (slot_type === SlotType.Event || slot_shape === SlotShape.Box) {
    if (horizontal) {
      ctx.rect(pos[0] - 5 + 0.5, pos[1] - 8 + 0.5, 10, 14)
    } else {
      ctx.rect(pos[0] - 6 + 0.5, pos[1] - 5 + 0.5, 14, 10)
    }
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
          cellSize,
        )
      }
    }
    doStroke = false
  } else {
    // Default rendering for circle, hollow circle.
    if (low_quality) {
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
  if (!low_quality && doStroke) ctx.stroke()

  // render slot label
  if (render_text) {
    const text = slot.label || slot.localized_name || slot.name
    if (text) {
      // TODO: Finish impl.  Highlight text on mouseover unless we're connecting links.
      ctx.fillStyle = label_color

      if (label_position === LabelPosition.Right) {
        if (horizontal || slot.dir == LinkDirection.UP) {
          ctx.fillText(text, pos[0], pos[1] - 10)
        } else {
          ctx.fillText(text, pos[0] + 10, pos[1] + 5)
        }
      } else {
        if (horizontal || slot.dir == LinkDirection.DOWN) {
          ctx.fillText(text, pos[0], pos[1] - 8)
        } else {
          ctx.fillText(text, pos[0] - 10, pos[1] + 5)
        }
      }
    }
  }

  // Restore the original fillStyle and strokeStyle
  ctx.fillStyle = originalFillStyle
  ctx.strokeStyle = originalStrokeStyle
  ctx.lineWidth = originalLineWidth
}

interface IDrawSelectionBoundingOptions {
  shape?: RenderShape
  round_radius?: number
  title_height?: number
  title_mode?: TitleMode
  colour?: CanvasColour
  padding?: number
  collapsed?: boolean
  thickness?: number
}

/**
 * Draws only the path of a shape on the canvas, without filling.
 * Used to draw indicators for node status, e.g. "selected".
 * @param ctx The 2D context to draw on
 * @param area The position and size of the shape to render
 */
export function strokeShape(
  ctx: CanvasRenderingContext2D,
  area: Rect,
  {
    /** The shape to render */
    shape = RenderShape.BOX,
    /** The radius of the rounded corners for {@link RenderShape.ROUND} and {@link RenderShape.CARD} */
    round_radius = LiteGraph.ROUND_RADIUS,
    /** Shape will extend above the Y-axis 0 by this amount */
    title_height = LiteGraph.NODE_TITLE_HEIGHT,
    /** @deprecated This is node-specific: it should be removed entirely, and behaviour defined by the caller more explicitly */
    title_mode = TitleMode.NORMAL_TITLE,
    /** The colour that should be drawn */
    colour = LiteGraph.NODE_BOX_OUTLINE_COLOR,
    /** The distance between the edge of the {@link area} and the middle of the line */
    padding = 6,
    /** @deprecated This is node-specific: it should be removed entirely, and behaviour defined by the caller more explicitly */
    collapsed = false,
    /** Thickness of the line drawn (`lineWidth`) */
    thickness = 1,
  }: IDrawSelectionBoundingOptions = {},
): void {
  // Adjust area if title is transparent
  if (title_mode === TitleMode.TRANSPARENT_TITLE) {
    area[1] -= title_height
    area[3] += title_height
  }

  // Set up context
  const { lineWidth, strokeStyle } = ctx
  ctx.lineWidth = thickness
  ctx.globalAlpha = 0.8
  ctx.strokeStyle = colour
  ctx.beginPath()

  // Draw shape based on type
  const [x, y, width, height] = area
  switch (shape) {
  case RenderShape.BOX: {
    ctx.rect(
      x - padding,
      y - padding,
      width + 2 * padding,
      height + 2 * padding,
    )
    break
  }
  case RenderShape.ROUND:
  case RenderShape.CARD: {
    const radius = round_radius + padding
    const isCollapsed = shape === RenderShape.CARD && collapsed
    const cornerRadii =
        isCollapsed || shape === RenderShape.ROUND
          ? [radius]
          : [radius, 2, radius, 2]
    ctx.roundRect(
      x - padding,
      y - padding,
      width + 2 * padding,
      height + 2 * padding,
      cornerRadii,
    )
    break
  }
  case RenderShape.CIRCLE: {
    const centerX = x + width / 2
    const centerY = y + height / 2
    const radius = Math.max(width, height) / 2 + padding
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    break
  }
  }

  // Stroke the shape
  ctx.stroke()

  // Reset context
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = strokeStyle

  // TODO: Store and reset value properly.  Callers currently expect this behaviour (e.g. muted nodes).
  ctx.globalAlpha = 1
}
