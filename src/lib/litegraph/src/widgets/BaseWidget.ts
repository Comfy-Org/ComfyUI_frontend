import { drawTextInArea } from '@/lib/litegraph/src/draw'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type { Point } from '@/lib/litegraph/src/interfaces'
import type {
  CanvasPointer,
  LGraphCanvas,
  LGraphNode,
  Size
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export interface DrawWidgetOptions {
  /** The width of the node where this widget will be displayed. */
  width: number
  /** Synonym for "low quality". */
  showText?: boolean
}

export interface DrawTruncatingTextOptions extends DrawWidgetOptions {
  /** The canvas context to draw the text on. */
  ctx: CanvasRenderingContext2D
  /** The amount of padding to add to the left of the text. */
  leftPadding?: number
  /** The amount of padding to add to the right of the text. */
  rightPadding?: number
}

export interface WidgetEventOptions {
  e: CanvasPointerEvent
  node: LGraphNode
  canvas: LGraphCanvas
}

export abstract class BaseWidget<TWidget extends IBaseWidget = IBaseWidget>
  implements IBaseWidget
{
  /** From node edge to widget edge */
  static margin = 15
  /** From widget edge to tip of arrow button */
  static arrowMargin = 6
  /** Arrow button width */
  static arrowWidth = 10
  /** Absolute minimum display width of widget values */
  static minValueWidth = 42
  /** Minimum gap between label and value */
  static labelValueGap = 5

  declare computedHeight?: number
  declare serialize?: boolean
  computeLayoutSize?(node: LGraphNode): {
    minHeight: number
    maxHeight?: number
    minWidth: number
    maxWidth?: number
  }

  #node: LGraphNode
  /** The node that this widget belongs to. */
  get node() {
    return this.#node
  }

  linkedWidgets?: IBaseWidget[]
  name: string
  options: TWidget['options']
  label?: string
  type: TWidget['type']
  y: number = 0
  last_y?: number
  width?: number
  disabled?: boolean
  computedDisabled?: boolean
  hidden?: boolean
  advanced?: boolean
  tooltip?: string
  element?: HTMLElement
  callback?(
    value: any,
    canvas?: LGraphCanvas,
    node?: LGraphNode,
    pos?: Point,
    e?: CanvasPointerEvent
  ): void
  mouse?(
    event: CanvasPointerEvent,
    pointerOffset: Point,
    node: LGraphNode
  ): boolean
  computeSize?(width?: number): Size
  onPointerDown?(
    pointer: CanvasPointer,
    node: LGraphNode,
    canvas: LGraphCanvas
  ): boolean

  #value?: TWidget['value']
  get value(): TWidget['value'] {
    return this.#value
  }

  set value(value: TWidget['value']) {
    this.#value = value
  }

  constructor(widget: TWidget & { node: LGraphNode })
  constructor(widget: TWidget, node: LGraphNode)
  constructor(widget: TWidget & { node: LGraphNode }, node?: LGraphNode) {
    // Private fields
    this.#node = node ?? widget.node

    // The set and get functions for DOM widget values are hacked on to the options object;
    // attempting to set value before options will throw.
    // https://github.com/Comfy-Org/ComfyUI_frontend/blob/df86da3d672628a452baed3df3347a52c0c8d378/src/scripts/domWidget.ts#L125
    this.name = widget.name
    this.options = widget.options
    this.type = widget.type

    // `node` has no setter - Object.assign will throw.
    // TODO: Resolve this workaround. Ref: https://github.com/Comfy-Org/litegraph.js/issues/1022
    const {
      node: _,
      // @ts-expect-error Prevent naming conflicts with custom nodes.
      outline_color,
      // @ts-expect-error Prevent naming conflicts with custom nodes.
      background_color,
      // @ts-expect-error Prevent naming conflicts with custom nodes.
      height,
      // @ts-expect-error Prevent naming conflicts with custom nodes.
      text_color,
      // @ts-expect-error Prevent naming conflicts with custom nodes.
      secondary_text_color,
      // @ts-expect-error Prevent naming conflicts with custom nodes.
      disabledTextColor,
      // @ts-expect-error Prevent naming conflicts with custom nodes.
      displayName,
      // @ts-expect-error Prevent naming conflicts with custom nodes.
      displayValue,
      // @ts-expect-error Prevent naming conflicts with custom nodes.
      labelBaseline,
      ...safeValues
    } = widget

    Object.assign(this, safeValues)
  }

  get outline_color() {
    return this.advanced
      ? LiteGraph.WIDGET_ADVANCED_OUTLINE_COLOR
      : LiteGraph.WIDGET_OUTLINE_COLOR
  }

  get background_color() {
    return LiteGraph.WIDGET_BGCOLOR
  }

  get height() {
    return LiteGraph.NODE_WIDGET_HEIGHT
  }

  get text_color() {
    return LiteGraph.WIDGET_TEXT_COLOR
  }

  get secondary_text_color() {
    return LiteGraph.WIDGET_SECONDARY_TEXT_COLOR
  }

  get disabledTextColor() {
    return LiteGraph.WIDGET_DISABLED_TEXT_COLOR
  }

  get displayName() {
    return this.label || this.name
  }

  // TODO: Resolve this workaround. Ref: https://github.com/Comfy-Org/litegraph.js/issues/1022
  get _displayValue(): string {
    return this.computedDisabled ? '' : String(this.value)
  }

  get labelBaseline() {
    return this.y + this.height * 0.7
  }

  /**
   * Draws the widget
   * @param ctx The canvas context
   * @param options The options for drawing the widget
   * @remarks Not naming this `draw` as `draw` conflicts with the `draw` method in
   * custom widgets.
   */
  abstract drawWidget(
    ctx: CanvasRenderingContext2D,
    options: DrawWidgetOptions
  ): void

  /**
   * Draws the standard widget shape - elongated capsule. The path of the widget shape is not
   * cleared, and may be used for further drawing.
   * @param ctx The canvas context
   * @param options The options for drawing the widget
   * @remarks Leaves {@link ctx} dirty.
   */
  protected drawWidgetShape(
    ctx: CanvasRenderingContext2D,
    { width, showText }: DrawWidgetOptions
  ): void {
    const { height, y } = this
    const { margin } = BaseWidget

    ctx.textAlign = 'left'
    ctx.strokeStyle = this.outline_color
    ctx.fillStyle = this.background_color
    ctx.beginPath()

    if (showText) {
      ctx.roundRect(margin, y, width - margin * 2, height, [height * 0.5])
    } else {
      ctx.rect(margin, y, width - margin * 2, height)
    }
    ctx.fill()
    if (showText && !this.computedDisabled) ctx.stroke()
  }

  /**
   * A shared routine for drawing a label and value as text, truncated
   * if they exceed the available width.
   */
  protected drawTruncatingText({
    ctx,
    width,
    leftPadding = 5,
    rightPadding = 20
  }: DrawTruncatingTextOptions): void {
    const { height, y } = this
    const { margin } = BaseWidget

    // Measure label and value
    const { displayName, _displayValue } = this
    const labelWidth = ctx.measureText(displayName).width
    const valueWidth = ctx.measureText(_displayValue).width

    const gap = BaseWidget.labelValueGap
    const x = margin * 2 + leftPadding

    const totalWidth = width - x - 2 * margin - rightPadding
    const requiredWidth = labelWidth + gap + valueWidth

    const area = new Rectangle(x, y, totalWidth, height * 0.7)

    ctx.fillStyle = this.secondary_text_color

    if (requiredWidth <= totalWidth) {
      // Draw label & value normally
      drawTextInArea({ ctx, text: displayName, area, align: 'left' })
    } else if (LiteGraph.truncateWidgetTextEvenly) {
      // Label + value will not fit - scale evenly to fit
      const scale = (totalWidth - gap) / (requiredWidth - gap)
      area.width = labelWidth * scale

      drawTextInArea({ ctx, text: displayName, area, align: 'left' })

      // Move the area to the right to render the value
      area.right = x + totalWidth
      area.setWidthRightAnchored(valueWidth * scale)
    } else if (LiteGraph.truncateWidgetValuesFirst) {
      // Label + value will not fit - use legacy scaling of value first
      const cappedLabelWidth = Math.min(labelWidth, totalWidth)

      area.width = cappedLabelWidth
      drawTextInArea({ ctx, text: displayName, area, align: 'left' })

      area.right = x + totalWidth
      area.setWidthRightAnchored(
        Math.max(totalWidth - gap - cappedLabelWidth, 0)
      )
    } else {
      // Label + value will not fit - scale label first
      const cappedValueWidth = Math.min(valueWidth, totalWidth)

      area.width = Math.max(totalWidth - gap - cappedValueWidth, 0)
      drawTextInArea({ ctx, text: displayName, area, align: 'left' })

      area.right = x + totalWidth
      area.setWidthRightAnchored(cappedValueWidth)
    }
    ctx.fillStyle = this.text_color
    drawTextInArea({ ctx, text: _displayValue, area, align: 'right' })
  }

  /**
   * Handles the click event for the widget
   * @param options The options for handling the click event
   */
  abstract onClick(options: WidgetEventOptions): void

  /**
   * Handles the drag event for the widget
   * @param options The options for handling the drag event
   */
  onDrag?(options: WidgetEventOptions): void

  /**
   * Sets the value of the widget
   * @param value The value to set
   * @param options The options for setting the value
   */
  setValue(
    value: TWidget['value'],
    { e, node, canvas }: WidgetEventOptions
  ): void {
    const oldValue = this.value
    if (value === this.value) return

    const v = this.type === 'number' ? Number(value) : value
    this.value = v
    if (
      this.options?.property &&
      node.properties[this.options.property] !== undefined
    ) {
      node.setProperty(this.options.property, v)
    }
    const pos = canvas.graph_mouse
    this.callback?.(this.value, canvas, node, pos, e)

    node.onWidgetChanged?.(this.name ?? '', v, oldValue, this)
    if (node.graph) node.graph._version++
  }

  /**
   * Clones the widget.
   * @param node The node that will own the cloned widget.
   * @returns A new widget with the same properties as the original
   * @remarks Subclasses with custom constructors must override this method.
   *
   * Correctly and safely typing this is currently not possible (practical?) in TypeScript 5.8.
   */
  createCopyForNode(node: LGraphNode): this {
    // @ts-expect-error - Constructor type casting for widget cloning
    const cloned: this = new (this.constructor as typeof this)(this, node)
    cloned.value = this.value
    return cloned
  }
}
