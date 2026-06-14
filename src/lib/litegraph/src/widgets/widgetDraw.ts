import { drawTextInArea } from '@/lib/litegraph/src/draw'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import { litegraph } from '@/lib/litegraph/src/litegraphInstance'
import { cachedMeasureText } from '@/lib/litegraph/src/utils/textMeasureCache'

import type { DrawWidgetOptions } from './BaseWidget'

/** From node edge to widget edge. */
export const WIDGET_MARGIN = 15
/** From widget edge to tip of arrow button. */
export const WIDGET_ARROW_MARGIN = 6
/** Arrow button width. */
export const WIDGET_ARROW_WIDTH = 10
/** Absolute minimum display width of widget values. */
export const WIDGET_MIN_VALUE_WIDTH = 42
/** Minimum gap between label and value. */
export const WIDGET_LABEL_VALUE_GAP = 5

/** Widget data read when resolving how a widget should look. */
interface WidgetVisualData {
  y: number
  advanced?: boolean
  computedDisabled?: boolean
}

/** Widget data read when drawing label/value text. */
interface WidgetTextData extends WidgetVisualData {
  displayName: string
  _displayValue: string
}

function outlineColor(widget: Pick<WidgetVisualData, 'advanced'>): string {
  const theme = litegraph()
  return widget.advanced
    ? theme.WIDGET_ADVANCED_OUTLINE_COLOR
    : theme.WIDGET_OUTLINE_COLOR
}

/** Visual values needed to draw a widget, resolved from widget data + theme. */
export function resolveWidgetVisual(widget: WidgetVisualData) {
  const theme = litegraph()
  return {
    y: widget.y,
    height: theme.NODE_WIDGET_HEIGHT,
    backgroundColor: theme.WIDGET_BGCOLOR,
    outlineColor: outlineColor(widget),
    textColor: theme.WIDGET_TEXT_COLOR
  }
}

/**
 * Draws the standard widget shape - elongated capsule. The path is not cleared,
 * and may be used for further drawing.
 * @remarks Leaves `ctx` dirty.
 */
export function drawWidgetShape(
  widget: WidgetVisualData,
  ctx: CanvasRenderingContext2D,
  { width, showText }: DrawWidgetOptions
): void {
  const { y } = widget
  const height = litegraph().NODE_WIDGET_HEIGHT

  ctx.textAlign = 'left'
  ctx.strokeStyle = outlineColor(widget)
  ctx.fillStyle = litegraph().WIDGET_BGCOLOR
  ctx.beginPath()

  if (showText) {
    ctx.roundRect(WIDGET_MARGIN, y, width - WIDGET_MARGIN * 2, height, [
      height * 0.5
    ])
  } else {
    ctx.rect(WIDGET_MARGIN, y, width - WIDGET_MARGIN * 2, height)
  }
  ctx.fill()
  if (showText && !widget.computedDisabled) ctx.stroke()
}

interface DrawTruncatingTextOptions {
  ctx: CanvasRenderingContext2D
  width: number
  leftPadding?: number
  rightPadding?: number
}

/**
 * Draws a label and value as text, truncated if they exceed the available
 * width.
 */
export function drawTruncatingText(
  widget: WidgetTextData,
  { ctx, width, leftPadding = 5, rightPadding = 20 }: DrawTruncatingTextOptions
): void {
  const theme = litegraph()
  const { y } = widget
  const height = theme.NODE_WIDGET_HEIGHT

  const { displayName, _displayValue } = widget
  const labelWidth = cachedMeasureText(ctx, displayName)
  const valueWidth = cachedMeasureText(ctx, _displayValue)

  const gap = WIDGET_LABEL_VALUE_GAP
  const x = WIDGET_MARGIN * 2 + leftPadding

  const totalWidth = width - x - 2 * WIDGET_MARGIN - rightPadding
  const requiredWidth = labelWidth + gap + valueWidth

  const area = new Rectangle(x, y, totalWidth, height * 0.7)

  ctx.fillStyle = theme.WIDGET_SECONDARY_TEXT_COLOR

  if (requiredWidth <= totalWidth) {
    drawTextInArea({ ctx, text: displayName, area, align: 'left' })
  } else if (theme.truncateWidgetTextEvenly) {
    const scale = (totalWidth - gap) / (requiredWidth - gap)
    area.width = labelWidth * scale

    drawTextInArea({ ctx, text: displayName, area, align: 'left' })

    area.right = x + totalWidth
    area.setWidthRightAnchored(valueWidth * scale)
  } else if (theme.truncateWidgetValuesFirst) {
    const cappedLabelWidth = Math.min(labelWidth, totalWidth)

    area.width = cappedLabelWidth
    drawTextInArea({ ctx, text: displayName, area, align: 'left' })

    area.right = x + totalWidth
    area.setWidthRightAnchored(Math.max(totalWidth - gap - cappedLabelWidth, 0))
  } else {
    const cappedValueWidth = Math.min(valueWidth, totalWidth)

    area.width = Math.max(totalWidth - gap - cappedValueWidth, 0)
    drawTextInArea({ ctx, text: displayName, area, align: 'left' })

    area.right = x + totalWidth
    area.setWidthRightAnchored(cappedValueWidth)
  }
  ctx.fillStyle = theme.WIDGET_TEXT_COLOR
  drawTextInArea({ ctx, text: _displayValue, area, align: 'right' })
}

/**
 * Draws the increment/decrement arrow buttons for stepped widgets. The caller
 * supplies whether each direction is currently enabled.
 */
export function drawArrowButtons(
  widget: Pick<WidgetVisualData, 'y'>,
  ctx: CanvasRenderingContext2D,
  width: number,
  canDecrement: boolean,
  canIncrement: boolean
): void {
  const theme = litegraph()
  const { y } = widget
  const height = theme.NODE_WIDGET_HEIGHT
  const textColor = theme.WIDGET_TEXT_COLOR
  const disabledTextColor = theme.WIDGET_DISABLED_TEXT_COLOR
  const arrowTipX = WIDGET_MARGIN + WIDGET_ARROW_MARGIN
  const arrowInnerX = arrowTipX + WIDGET_ARROW_WIDTH

  ctx.fillStyle = canDecrement ? textColor : disabledTextColor
  ctx.beginPath()
  ctx.moveTo(arrowInnerX, y + 5)
  ctx.lineTo(arrowTipX, y + height * 0.5)
  ctx.lineTo(arrowInnerX, y + height - 5)
  ctx.fill()

  ctx.fillStyle = canIncrement ? textColor : disabledTextColor
  ctx.beginPath()
  ctx.moveTo(width - arrowInnerX, y + 5)
  ctx.lineTo(width - arrowTipX, y + height * 0.5)
  ctx.lineTo(width - arrowInnerX, y + height - 5)
  ctx.fill()
}
