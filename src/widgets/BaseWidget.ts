import type { CanvasPointer, LGraphCanvas, LGraphNode, Size } from "@/litegraph"
import type { CanvasMouseEvent, CanvasPointerEvent } from "@/types/events"
import type { IBaseWidget, IWidget, IWidgetOptions, TWidgetType, TWidgetValue } from "@/types/widgets"

import { Point } from "@/interfaces"
import { LiteGraph } from "@/litegraph"

export interface DrawWidgetOptions {
  y: number
  width: number
  show_text?: boolean
  margin?: number
}

export abstract class BaseWidget implements IBaseWidget {
  linkedWidgets?: IWidget[]
  name: string
  options: IWidgetOptions<unknown>
  label?: string
  type: TWidgetType
  value?: TWidgetValue
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
    e?: CanvasMouseEvent,
  ): void
  mouse?(event: CanvasPointerEvent, pointerOffset: Point, node: LGraphNode): boolean
  draw?(
    ctx: CanvasRenderingContext2D,
    node: LGraphNode,
    widget_width: number,
    y: number,
    H: number,
  ): void
  computeSize?(width?: number): Size
  onPointerDown?(pointer: CanvasPointer, node: LGraphNode, canvas: LGraphCanvas): boolean

  constructor(widget: IBaseWidget) {
    Object.assign(this, widget)
    this.name = widget.name
    this.options = widget.options
    this.type = widget.type
  }

  get outline_color() {
    return this.advanced ? LiteGraph.WIDGET_ADVANCED_OUTLINE_COLOR : LiteGraph.WIDGET_OUTLINE_COLOR
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

  /**
   * Draws the widget
   * @param ctx The canvas context
   * @param options The options for drawing the widget
   * @remarks Not naming this `draw` as `draw` conflicts with the `draw` method in
   * custom widgets.
   */
  abstract drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void

  /**
   * Handles the click event for the widget
   * @param options The options for handling the click event
   */
  abstract onClick(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }): void

  /**
   * Handles the drag event for the widget
   * @param options The options for handling the drag event
   */
  onDrag?(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }): void

  /**
   * Sets the value of the widget
   * @param value The value to set
   * @param options The options for setting the value
   */
  setValue(value: TWidgetValue, options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    const { node, canvas, e } = options
    const oldValue = this.value
    if (value === this.value) return

    const v = this.type === "number" ? Number(value) : value
    this.value = v
    if (
      this.options?.property &&
      node.properties[this.options.property] !== undefined
    ) {
      node.setProperty(this.options.property, v)
    }
    const pos = canvas.graph_mouse
    this.callback?.(this.value, canvas, node, pos, e)

    node.onWidgetChanged?.(this.name ?? "", v, oldValue, this as IWidget)
    if (node.graph) node.graph._version++
  }
}
