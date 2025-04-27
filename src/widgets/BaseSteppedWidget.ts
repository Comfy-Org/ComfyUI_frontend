import { BaseWidget, type WidgetEventOptions } from "./BaseWidget"

/**
 * Base class for widgets that have increment and decrement buttons.
 */
export abstract class BaseSteppedWidget extends BaseWidget {
  /**
   * Whether the widget can increment its value
   * @returns `true` if the widget can increment its value, otherwise `false`
   */
  abstract canIncrement(): boolean
  /**
   * Whether the widget can decrement its value
   * @returns `true` if the widget can decrement its value, otherwise `false`
   */
  abstract canDecrement(): boolean
  /**
   * Increment the value of the widget
   * @param options The options for the widget event
   */
  abstract incrementValue(options: WidgetEventOptions): void
  /**
   * Decrement the value of the widget
   * @param options The options for the widget event
   */
  abstract decrementValue(options: WidgetEventOptions): void

  /**
   * Draw the arrow buttons for the widget
   * @param ctx The canvas rendering context
   * @param margin The margin of the widget
   * @param y The y position of the widget
   * @param width The width of the widget
   */
  drawArrowButtons(ctx: CanvasRenderingContext2D, margin: number, y: number, width: number) {
    const { height, text_color, disabledTextColor } = this
    const { arrowMargin, arrowWidth } = BaseWidget
    const arrowTipX = margin + arrowMargin
    const arrowInnerX = arrowTipX + arrowWidth

    // Draw left arrow
    ctx.fillStyle = this.canDecrement() ? text_color : disabledTextColor
    ctx.beginPath()
    ctx.moveTo(arrowInnerX, y + 5)
    ctx.lineTo(arrowTipX, y + height * 0.5)
    ctx.lineTo(arrowInnerX, y + height - 5)
    ctx.fill()

    // Draw right arrow
    ctx.fillStyle = this.canIncrement() ? text_color : disabledTextColor
    ctx.beginPath()
    ctx.moveTo(width - arrowInnerX, y + 5)
    ctx.lineTo(width - arrowTipX, y + height * 0.5)
    ctx.lineTo(width - arrowInnerX, y + height - 5)
    ctx.fill()
  }
}
