import { Point } from "@/interfaces"
import { LiteGraph } from "@/litegraph"
import type { CanvasPointer, LGraphCanvas, LGraphNode, Size } from "@/litegraph"
import type { CanvasMouseEvent, CanvasPointerEvent } from "@/types/events"
import type { IBaseWidget, IWidget, IWidgetOptions } from "@/types/widgets"

export abstract class BaseWidget implements IBaseWidget {
  linkedWidgets?: IWidget[]
  options: IWidgetOptions<unknown>
  marker?: number
  label?: string
  clicked?: boolean
  name?: string
  type?: "string" | "number" | "combo" | "button" | "toggle" | "slider" | "text" | "multiline" | "custom"
  value?: string | number | boolean | object
  y?: number
  last_y?: number
  width?: number
  disabled?: boolean
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
    this.options = widget.options
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

  abstract drawWidget(ctx: CanvasRenderingContext2D, options: {
    y: number
    width: number
    show_text?: boolean
    margin?: number
  }): void
}
