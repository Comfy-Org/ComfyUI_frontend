import { t } from '@/i18n'
import type { Point } from '@/lib/litegraph/src/interfaces'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  CanvasPointer,
  LGraphCanvas,
  LGraphNode,
  Size
} from '@/lib/litegraph/src/litegraph'
import { litegraph } from '@/lib/litegraph/src/litegraphInstance'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type {
  IBaseWidget,
  NodeBindable,
  TWidgetType
} from '@/lib/litegraph/src/types/widgets'
import { registerWidgetControlFromConfig } from '@/core/graph/widgets/control/widgetControl'
import { getWidgetLayout } from '@/core/graph/widgets/layout/widgetLayout'
import {
  WIDGET_ARROW_MARGIN,
  WIDGET_ARROW_WIDTH,
  WIDGET_LABEL_VALUE_GAP,
  WIDGET_MARGIN,
  WIDGET_MIN_VALUE_WIDTH,
  drawTruncatingText,
  drawWidgetShape
} from '@/lib/litegraph/src/widgets/widgetDraw'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'

export interface DrawWidgetOptions {
  /** The width of the node where this widget will be displayed. */
  width: number
  /** Synonym for "low quality". */
  showText?: boolean
  /** Transient image source for preview widgets rendered on behalf of another node (e.g. subgraph promotion). */
  previewImages?: HTMLImageElement[]
}

interface DrawTruncatingTextOptions extends DrawWidgetOptions {
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
  implements IBaseWidget, NodeBindable
{
  /** From node edge to widget edge */
  static margin = WIDGET_MARGIN
  /** From widget edge to tip of arrow button */
  static arrowMargin = WIDGET_ARROW_MARGIN
  /** Arrow button width */
  static arrowWidth = WIDGET_ARROW_WIDTH
  /** Absolute minimum display width of widget values */
  static minValueWidth = WIDGET_MIN_VALUE_WIDTH
  /** Minimum gap between label and value */
  static labelValueGap = WIDGET_LABEL_VALUE_GAP

  declare serialize?: boolean
  computeLayoutSize?(node: LGraphNode): {
    minHeight: number
    maxHeight?: number
    minWidth: number
    maxWidth?: number
  }

  private _node: LGraphNode
  /** The node that this widget belongs to. */
  get node() {
    return this._node
  }

  linkedWidgets?: IBaseWidget[]
  name: string
  options: TWidget['options']
  type: TWidget['type']
  width?: number
  tooltip?: string

  /** Y offset within the node, set during arrange. Backed by a frame-stable layout cache. */
  get y(): number {
    return getWidgetLayout(this).y
  }
  set y(value: number) {
    getWidgetLayout(this).y = value
  }

  /** Y offset captured at draw time, read during hit-testing. */
  get last_y(): number | undefined {
    return getWidgetLayout(this).last_y
  }
  set last_y(value: number | undefined) {
    getWidgetLayout(this).last_y = value
  }

  /** Height computed during arrange. */
  get computedHeight(): number | undefined {
    return getWidgetLayout(this).computedHeight
  }
  set computedHeight(value: number | undefined) {
    getWidgetLayout(this).computedHeight = value
  }

  /** Disabled state derived each draw, read during draw and measurement. */
  get computedDisabled(): boolean | undefined {
    return getWidgetLayout(this).computedDisabled
  }
  set computedDisabled(value: boolean | undefined) {
    getWidgetLayout(this).computedDisabled = value
  }

  private _state: Omit<WidgetState, 'nodeId'> &
    Partial<Pick<WidgetState, 'nodeId'>>

  get label(): string | undefined {
    return this._state.label
  }
  set label(value: string | undefined) {
    this._state.label = value
  }

  get disabled(): boolean | undefined {
    return this._state.disabled
  }
  set disabled(value: boolean | undefined) {
    this._state.disabled = value ?? false
  }

  get hidden(): boolean | undefined {
    return this._state.hidden
  }
  set hidden(value: boolean | undefined) {
    this._state.hidden = value
  }

  get advanced(): boolean | undefined {
    return this._state.advanced
  }
  set advanced(value: boolean | undefined) {
    this._state.advanced = value
  }

  element?: HTMLElement
  callback?(
    value: TWidget['value'],
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

  get value(): TWidget['value'] {
    return this._state.value as TWidget['value']
  }
  set value(value: TWidget['value']) {
    this._state.value = value
  }

  get widgetId(): WidgetId | undefined {
    const graphId = this.node.graph?.rootGraph.id
    const nodeId = this._state?.nodeId
    if (!graphId || nodeId === undefined) return undefined
    return widgetId(graphId, nodeId, this.name)
  }

  /**
   * Associates this widget with a node ID and registers it in the WidgetValueStore.
   * Once set, value reads/writes will be delegated to the store.
   */
  setNodeId(nodeId: NodeId): void {
    const graphId = this.node.graph?.rootGraph.id
    if (!graphId) return

    const id = widgetId(graphId, nodeId, this.name)
    this._state = useWidgetValueStore().registerWidget(id, {
      ...this._state,
      value: this.value
    })
    registerWidgetControlFromConfig(this)
  }

  constructor(widget: TWidget & { node: LGraphNode })
  constructor(widget: TWidget, node: LGraphNode)
  constructor(widget: TWidget & { node: LGraphNode }, node?: LGraphNode) {
    // Private fields
    this._node = node ?? widget.node

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
      label,
      disabled,
      hidden,
      advanced,
      value,
      linkedWidgets,
      ...safeValues
    } = widget

    Object.assign(this, safeValues)

    this._state = {
      name: this.name,
      type: this.type as TWidgetType,
      value,
      label,
      disabled: disabled ?? false,
      hidden,
      advanced,
      serialize: this.serialize,
      options: this.options,
      y: this.y
    }
  }

  getOutlineColor() {
    return this.advanced
      ? litegraph().WIDGET_ADVANCED_OUTLINE_COLOR
      : litegraph().WIDGET_OUTLINE_COLOR
  }

  get outline_color() {
    return this.getOutlineColor()
  }

  get background_color() {
    return litegraph().WIDGET_BGCOLOR
  }

  get height() {
    return litegraph().NODE_WIDGET_HEIGHT
  }

  get text_color() {
    return litegraph().WIDGET_TEXT_COLOR
  }

  get secondary_text_color() {
    return litegraph().WIDGET_SECONDARY_TEXT_COLOR
  }

  get disabledTextColor() {
    return litegraph().WIDGET_DISABLED_TEXT_COLOR
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
    options: DrawWidgetOptions
  ): void {
    drawWidgetShape(this, ctx, options)
  }

  /**
   * Draws a placeholder for widgets that only have a Vue implementation.
   * @param ctx The canvas context
   * @param options The options for drawing the widget
   * @param label The label to display (e.g., "ImageCrop", "BoundingBox")
   */
  protected drawVueOnlyWarning(
    ctx: CanvasRenderingContext2D,
    { width }: DrawWidgetOptions,
    label: string
  ): void {
    const { y, height } = this

    ctx.save()

    ctx.fillStyle = this.background_color
    ctx.fillRect(15, y, width - 30, height)

    ctx.strokeStyle = this.getOutlineColor()
    ctx.strokeRect(15, y, width - 30, height)

    ctx.fillStyle = this.text_color
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillText(
      `${label}: ${t('widgets.node2only')}`,
      width / 2,
      y + height / 2
    )

    ctx.restore()
  }

  /**
   * A shared routine for drawing a label and value as text, truncated
   * if they exceed the available width.
   */
  protected drawTruncatingText(options: DrawTruncatingTextOptions): void {
    drawTruncatingText(this, options)
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
    if (node.graph) node.graph.incrementVersion()
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
    cloned.y = this.y
    cloned.last_y = this.last_y
    cloned.computedHeight = this.computedHeight
    cloned.computedDisabled = this.computedDisabled
    return cloned
  }
}
