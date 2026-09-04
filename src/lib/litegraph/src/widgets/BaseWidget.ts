import { t } from '@/i18n'
import { drawTextInArea } from '@/lib/litegraph/src/draw'
import { cachedMeasureText } from '@/lib/litegraph/src/utils/textMeasureCache'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type { Point } from '@/lib/litegraph/src/interfaces'
import type { NodeId } from '@/types/nodeId'
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
  NodeBindable
} from '@/lib/litegraph/src/types/widgets'
import { deriveWidgetRenderState } from '@/lib/litegraph/src/utils/widget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'
import { ensureUniqueWidgetNames, widgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'
import {
  applyLegacyAdvancedWrite,
  applyLegacyCanvasOnlyWrite,
  applyLegacyHiddenWrite,
  deriveWidgetVisibility,
  isLegacyHiddenWidgetType,
  isLegacyWidgetHidingType,
  isWidgetAdvanced,
  isWidgetHidden,
  isWidgetHiddenInPanel,
  setWidgetAdvanced,
  setWidgetHiddenInPanel
} from '@/types/widgetVisibility'
import type { WidgetVisibilityComponent } from '@/types/widgetVisibility'

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

const rawOptionsByShim = new WeakMap<object, object>()

/**
 * Extensions sometimes assign a widget's own options facade back to itself
 * (e.g. `widget.options = widget.options || {}`). Unwrap any shim proxy to its
 * plain target so `_rawOptions` never aliases a proxy, which would make the
 * hidden-mirror write in the `hidden` setter recurse through the set trap.
 */
function unwrapOptionsShim<TOptions extends object>(
  options: TOptions | undefined
): TOptions | undefined {
  if (!options) return options
  return (rawOptionsByShim.get(options) ?? options) as TOptions
}

type LegacyVisibilityKey = 'hidden' | 'hideInPanel' | 'advanced' | 'canvasOnly'

type BaseWidgetState<TWidget extends IBaseWidget> = WidgetState<
  TWidget['value'],
  TWidget['type'],
  TWidget['options']
>

export interface WidgetEventOptions {
  e: CanvasPointerEvent
  node: LGraphNode
  canvas: LGraphCanvas
}

export abstract class BaseWidget<TWidget extends IBaseWidget = IBaseWidget>
  implements IBaseWidget, NodeBindable
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

  private _node: LGraphNode
  /** The node that this widget belongs to. */
  get node() {
    return this._node
  }

  linkedWidgets?: IBaseWidget[]
  private _name!: string
  get name(): string {
    return this._name
  }

  set name(value: string) {
    const previous = this._name
    if (previous === undefined || previous === value) {
      this._name = value
      return
    }

    const graphId = this.node.graph?.rootGraph.id
    const nodeId = this._state.nodeId
    if (!graphId || nodeId === undefined) {
      this._name = value
      return
    }

    const moved = useWidgetValueStore().renameWidget(
      widgetId(graphId, nodeId, previous),
      widgetId(graphId, nodeId, value)
    )
    if (!moved) return

    this._name = value
    this._state = moved
  }

  private _rawOptions!: TWidget['options']
  private _options!: TWidget['options']

  get options(): TWidget['options'] {
    return this._options
  }

  set options(rawOptions: TWidget['options']) {
    const previousHidden = this._rawOptions?.hidden
    this.installOptionsShim(rawOptions)
    if (previousHidden !== undefined) this._rawOptions.hidden = previousHidden
    if (this._state) this._state.options = this._rawOptions
    this.syncVisibilityFromOptions()
  }

  /**
   * Re-applies visibility metadata carried on the raw options object after a
   * wholesale `widget.options = {...}` replacement, matching the legacy read
   * paths that consulted `options.hidden` / `options.hideInPanel` /
   * `options.advanced` / `options.canvasOnly` live.
   */
  private syncVisibilityFromOptions(): void {
    const raw = this._rawOptions
    this.applyLegacyVisibilityKey('hidden', raw.hidden)
    this.applyLegacyVisibilityKey('hideInPanel', raw.hideInPanel)
    this.applyLegacyVisibilityKey('advanced', raw.advanced)
    this.applyLegacyVisibilityKey('canvasOnly', raw.canvasOnly)
  }

  private applyLegacyVisibilityKey(
    key: LegacyVisibilityKey,
    value: unknown
  ): void {
    const enabled = value === true
    if (key === 'hidden') {
      if (value === undefined) applyLegacyHiddenWrite(this._visibility, false)
      else this.hidden = enabled
    } else if (key === 'hideInPanel') {
      setWidgetHiddenInPanel(this._visibility, enabled)
    } else if (key === 'canvasOnly') {
      applyLegacyCanvasOnlyWrite(this._visibility, {
        type: this.type,
        options: { ...this._rawOptions, canvasOnly: enabled }
      })
    } else {
      setWidgetAdvanced(this._visibility, enabled, ['vueNode', 'panel'])
    }
  }

  /**
   * Binds the legacy visibility options compatibility shim to this object.
   * Widget adoption copies property descriptors onto the original widget
   * object, so the adopting object must rebind the shim to itself; otherwise
   * visibility writes land on the discarded donor instance.
   */
  installOptionsShim(rawOptions: TWidget['options'] = this._rawOptions): void {
    this._rawOptions = unwrapOptionsShim(rawOptions) ?? {}
    this._options = new Proxy(this._rawOptions, {
      get: (target, property, receiver) => {
        if (property === 'hidden')
          return this._visibility.suppression.byExtension
        if (property === 'hideInPanel') {
          return isWidgetHiddenInPanel(this._visibility)
        }
        if (property === 'advanced') return isWidgetAdvanced(this._visibility)
        return Reflect.get(target, property, receiver)
      },
      set: (target, property, value, receiver) => {
        if (this.isLegacyVisibilityKey(property)) {
          this.applyLegacyVisibilityKey(property, value)
          return Reflect.set(target, property, value, receiver)
        }
        return Reflect.set(target, property, value, receiver)
      },
      deleteProperty: (target, property) => {
        if (this.isLegacyVisibilityKey(property)) {
          this.applyLegacyVisibilityKey(property, undefined)
        }
        return Reflect.deleteProperty(target, property)
      }
    })
    rawOptionsByShim.set(this._options, this._rawOptions)
  }

  private isLegacyVisibilityKey(
    property: PropertyKey
  ): property is LegacyVisibilityKey {
    return (
      property === 'hidden' ||
      property === 'hideInPanel' ||
      property === 'advanced' ||
      property === 'canvasOnly'
    )
  }

  private _type!: TWidget['type']
  get type(): TWidget['type'] {
    return this._type
  }
  set type(value: TWidget['type']) {
    this.setWidgetType(value)
  }

  private setWidgetType(value: TWidget['type']): void {
    const wasLegacyHiding = isLegacyWidgetHidingType(this._type)
    this._type = value
    if (isLegacyHiddenWidgetType(value)) {
      applyLegacyHiddenWrite(this._visibility, true)
    } else if (wasLegacyHiding) {
      applyLegacyHiddenWrite(
        this._visibility,
        this._rawOptions?.hidden === true
      )
    }
  }

  private installTypeVisibilityShim(): void {
    const descriptor = Object.getOwnPropertyDescriptor(this, 'type')
    if (!descriptor || descriptor.get || descriptor.set) return

    this._type = this.type
    Object.defineProperty(this, 'type', {
      configurable: true,
      enumerable: true,
      get: () => this._type,
      set: (value: TWidget['type']) => this.setWidgetType(value)
    })
  }
  y: number = 0
  last_y?: number
  width?: number
  computedDisabled?: boolean
  tooltip?: string

  private _state: Omit<BaseWidgetState<TWidget>, 'nodeId'> &
    Partial<Pick<BaseWidgetState<TWidget>, 'nodeId'>>

  get label(): string | undefined {
    return this._state.label
  }
  set label(value: string | undefined) {
    this._state.label = value
  }

  private _visibility: WidgetVisibilityComponent = {
    surfaces: { canvas: 'shown', vueNode: 'shown', panel: 'shown' },
    suppression: { byExtension: false, byConnection: false }
  }

  get visibility(): WidgetVisibilityComponent {
    return this._visibility
  }

  get hidden(): boolean {
    return isWidgetHidden(this._visibility)
  }
  set hidden(value: boolean | undefined) {
    applyLegacyHiddenWrite(this._visibility, value ?? false)
    // Hidden writes made while the widget type itself forces hiding (e.g.
    // 'converted-widget') are conversion bookkeeping, not registration
    // intent; keep them out of rawOptions so restoring the type recovers
    // the registration-time hidden state.
    if (this._rawOptions && !isLegacyWidgetHidingType(this._type)) {
      this._rawOptions.hidden = value
    }
  }

  get advanced(): boolean {
    return isWidgetAdvanced(this._visibility)
  }
  set advanced(value: boolean | undefined) {
    applyLegacyAdvancedWrite(
      this._visibility,
      value,
      this._rawOptions?.advanced !== undefined
    )
  }

  get connectionSuppressed(): boolean {
    return this._visibility.suppression.byConnection
  }
  set connectionSuppressed(value: boolean | undefined) {
    this._visibility.suppression.byConnection = value === true
  }

  get disabled(): boolean | undefined {
    return this._state.disabled
  }
  set disabled(value: boolean | undefined) {
    this._state.disabled = value ?? false
  }

  // fallow-ignore-next-line unused-class-member
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
    return this._state.value
  }
  set value(value: TWidget['value']) {
    this._state.value = value
  }

  get widgetId(): WidgetId | undefined {
    const graphId = this.node.graph?.rootGraph.id
    const nodeId = this._state.nodeId
    if (!graphId || nodeId === undefined) return undefined
    if (!ensureUniqueWidgetNames(this.node.widgets ?? [this])) return undefined
    return widgetId(graphId, nodeId, this.name)
  }

  /**
   * Associates this widget with a node ID and registers it in the WidgetValueStore.
   * Once set, value reads/writes will be delegated to the store.
   */
  setNodeId(nodeId: NodeId): void {
    this.installTypeVisibilityShim()
    const graphId = this.node.graph?.rootGraph.id
    if (!graphId) return
    if (!ensureUniqueWidgetNames(this.node.widgets ?? [this])) return

    const registered = useWidgetValueStore().registerWidget(
      widgetId(graphId, nodeId, this.name),
      {
        disabled: this.disabled,
        label: this.label,
        name: this.name,
        options: this._state.options,
        serialize: this.serialize,
        type: this.type,
        value: this.value,
        y: this.y
      },
      deriveWidgetRenderState(this),
      this._visibility
    )
    if (!registered) return
    this._state = registered
    const visibility = useWidgetValueStore().getWidgetVisibility(
      widgetId(graphId, nodeId, this.name)
    )
    if (visibility) this._visibility = visibility
  }

  constructor(widget: TWidget & { node: LGraphNode })
  constructor(widget: TWidget, node: LGraphNode)
  constructor(widget: TWidget & { node: LGraphNode }, node?: LGraphNode) {
    // Private fields
    this._node = node ?? widget.node

    this._visibility = deriveWidgetVisibility(widget)

    // The set and get functions for DOM widget values are hacked on to the options object;
    // attempting to set value before options will throw.
    // https://github.com/Comfy-Org/ComfyUI_frontend/blob/df86da3d672628a452baed3df3347a52c0c8d378/src/scripts/domWidget.ts#L125
    this.name = widget.name
    this.installOptionsShim(widget.options)
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
      hidden,
      disabled,
      value,
      linkedWidgets,
      name: _name,
      options: _options,
      type: _type,
      ...safeValues
    } = widget

    Object.assign(this, safeValues)

    this._state = {
      name: this.name,
      type: this.type,
      value,
      label,
      disabled: disabled ?? false,
      serialize: this.serialize,
      options: this._rawOptions,
      y: this.y
    }
    if (hidden !== undefined) this.hidden = hidden
  }

  getOutlineColor() {
    return this._visibility.surfaces.canvas === 'advanced'
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
    { width, showText }: DrawWidgetOptions
  ): void {
    const { height, y } = this
    const { margin } = BaseWidget

    ctx.textAlign = 'left'
    ctx.strokeStyle = this.getOutlineColor()
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
   * Draws only the widget's name for a row whose control is suppressed by an
   * upstream connection. The connected input slot dot is drawn separately by
   * slot rendering. Called from LGraphNode via toConcreteWidget, which fallow
   * cannot resolve.
   */
  // fallow-ignore-next-line unused-class-member
  drawSuppressedRowLabel(
    ctx: CanvasRenderingContext2D,
    { width }: DrawWidgetOptions
  ): void {
    ctx.textAlign = 'left'
    this.drawTruncatingText({ ctx, width })
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
    const labelWidth = cachedMeasureText(ctx, displayName)
    const valueWidth = cachedMeasureText(ctx, _displayValue)

    const gap = BaseWidget.labelValueGap
    const x = margin * 2 + leftPadding

    const totalWidth = width - x - 2 * margin - rightPadding
    const requiredWidth = labelWidth + gap + valueWidth

    const area = new Rectangle(x, y, totalWidth, height * 0.7)

    ctx.fillStyle = this.secondary_text_color

    if (requiredWidth <= totalWidth) {
      // Draw label & value normally
      drawTextInArea({ ctx, text: displayName, area, align: 'left' })
    } else if (litegraph().truncateWidgetTextEvenly) {
      // Label + value will not fit - scale evenly to fit
      const scale = (totalWidth - gap) / (requiredWidth - gap)
      area.width = labelWidth * scale

      drawTextInArea({ ctx, text: displayName, area, align: 'left' })

      // Move the area to the right to render the value
      area.right = x + totalWidth
      area.setWidthRightAnchored(valueWidth * scale)
    } else if (litegraph().truncateWidgetValuesFirst) {
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
    return cloned
  }
}
