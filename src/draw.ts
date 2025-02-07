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

interface IDrawSelectionBoundingOptions {
  /** The shape to render */
  shape?: RenderShape
  /** The radius of the rounded corners for {@link RenderShape.ROUND} and {@link RenderShape.CARD} */
  round_radius?: number
  /** Shape will extend above the Y-axis 0 by this amount */
  title_height?: number
  /** @deprecated This is node-specific: it should be removed entirely, and behaviour defined by the caller more explicitly */
  title_mode?: TitleMode
  /** The colour that should be drawn */
  colour?: CanvasColour
  /** The distance between the edge of the {@link area} and the middle of the line */
  padding?: number
  /** @deprecated This is node-specific: it should be removed entirely, and behaviour defined by the caller more explicitly */
  collapsed?: boolean
  /** Thickness of the line drawn (`lineWidth`) */
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
  options: IDrawSelectionBoundingOptions = {},
): void {
  // Don't deconstruct in function arguments. If deconstructed in the argument list, the defaults will be evaluated
  // once when the function is defined, and will not be re-evaluated when the function is called.
  const {
    shape = RenderShape.BOX,
    round_radius = LiteGraph.ROUND_RADIUS,
    title_height = LiteGraph.NODE_TITLE_HEIGHT,
    title_mode = TitleMode.NORMAL_TITLE,
    colour = LiteGraph.NODE_BOX_OUTLINE_COLOR,
    padding = 6,
    collapsed = false,
    thickness = 1,
  } = options

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
