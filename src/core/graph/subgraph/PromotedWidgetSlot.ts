import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  DrawWidgetOptions,
  WidgetEventOptions
} from '@/lib/litegraph/src/widgets/BaseWidget'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import { isDOMWidget, isComponentWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'

import { createPromotedDomWidgetAdapter } from './PromotedDomWidgetAdapter'

type WidgetValue = IBaseWidget['value']

/**
 * A lightweight widget slot for canvas rendering of promoted subgraph widgets.
 *
 * Owns positional state (y, last_y, width) and delegates value/type/drawing
 * to the resolved interior widget via the WidgetValueStore.
 *
 * When the interior node/widget no longer exists (disconnected state),
 * it renders a "Disconnected" placeholder.
 */
export class PromotedWidgetSlot extends BaseWidget<IBaseWidget> {
  override readonly isPromotedSlot = true
  readonly sourceNodeId: NodeId
  readonly sourceWidgetName: string
  private readonly subgraphNode: SubgraphNode

  /**
   * When the interior widget is a DOM widget, this adapter is registered in
   * `domWidgetStore` so that `DomWidgets.vue` positions the DOM element on the
   * SubgraphNode rather than the interior node.
   */
  private domAdapter?: BaseDOMWidget<object | string>

  constructor(
    subgraphNode: SubgraphNode,
    sourceNodeId: NodeId,
    sourceWidgetName: string,
    slotName?: string
  ) {
    const name = slotName ?? `${sourceNodeId}: ${sourceWidgetName}`
    super(
      {
        name,
        type: 'button',
        value: undefined,
        options: {},
        y: 0,
        serialize: false
      },
      subgraphNode
    )
    this.sourceNodeId = sourceNodeId
    this.sourceWidgetName = sourceWidgetName
    this.subgraphNode = subgraphNode

    // BaseWidget constructor assigns `this.type` and `this.options` as own
    // data properties. Override them with instance-level accessors that
    // delegate to the resolved interior widget.
    Object.defineProperty(this, 'type', {
      get: () => this.resolve()?.widget.type ?? 'button',
      configurable: true,
      enumerable: true
    })
    Object.defineProperty(this, 'options', {
      get: () => this.resolve()?.widget.options ?? {},
      configurable: true,
      enumerable: true
    })

    // The SubgraphNode's input slots are internally linked, which causes
    // `updateComputedDisabled()` to set `computedDisabled = true` on all
    // matching widgets.  The promoted slot should always remain interactive.
    Object.defineProperty(this, 'computedDisabled', {
      get: () => false,
      set: () => {},
      configurable: true,
      enumerable: true
    })

    this.callback = (value, canvas, _node, pos, e) => {
      const resolved = this.resolve()
      if (!resolved) return
      resolved.widget.callback?.(value, canvas, resolved.node, pos, e)
    }

    this.syncDomAdapter()
  }

  /**
   * Delegates to the interior widget's `computeLayoutSize` so that
   * `_arrangeWidgets` treats this slot as a growable widget (e.g. textarea)
   * and allocates the correct height on the SubgraphNode.
   *
   * Assigned dynamically in the constructor via `syncLayoutSize` because
   * `computeLayoutSize` is an optional method on the base class — it must
   * either exist or not exist, not return `undefined`.
   */
  declare computeLayoutSize?: (node: LGraphNode) => {
    minHeight: number
    maxHeight?: number
    minWidth: number
    maxWidth?: number
  }

  /**
   * Copies `computeLayoutSize` from the interior widget when it has one
   * (e.g. textarea / DOM widgets), so `_arrangeWidgets` allocates the
   * correct growable height on the SubgraphNode.
   */
  private syncLayoutSize(): void {
    const interiorWidget = this.resolve()?.widget
    if (interiorWidget?.computeLayoutSize) {
      this.computeLayoutSize = (node) => interiorWidget.computeLayoutSize!(node)
    } else {
      this.computeLayoutSize = undefined
    }
  }

  private resolve(): {
    node: LGraphNode
    widget: IBaseWidget
  } | null {
    try {
      const node = this.subgraphNode.subgraph.getNodeById(this.sourceNodeId)
      if (!node) return null
      const widget = node.widgets?.find((w) => w.name === this.sourceWidgetName)
      if (!widget) return null
      return { node, widget }
    } catch {
      // May fail during construction if the subgraph is not yet fully wired
      // (e.g. in tests or during deserialization).
      return null
    }
  }

  private get widgetState() {
    return useWidgetValueStore().getWidget(
      stripGraphPrefix(this.sourceNodeId),
      this.sourceWidgetName
    )
  }

  override get value(): WidgetValue {
    return this.widgetState?.value as WidgetValue
  }

  override set value(v: WidgetValue) {
    const state = this.widgetState
    if (!state) return

    state.value = v
  }

  override get label(): string | undefined {
    return this.widgetState?.label ?? this.name
  }

  override set label(v: string | undefined) {
    const state = this.widgetState
    if (!state) return

    state.label = v

    // Also sync the label on the corresponding input slot
    const resolved = this.resolve()
    const input = resolved?.node.inputs?.find(
      (inp) => inp.widget?.name === this.sourceWidgetName
    )
    if (!input) return

    input.label = v
  }

  override get promoted(): boolean {
    return false
  }

  override get _displayValue(): string {
    if (this.computedDisabled) return ''
    if (!this.resolve()) return 'Disconnected'
    const v = this.value
    return v != null ? String(v) : ''
  }

  /**
   * Creates or removes the DOM adapter based on whether the resolved interior
   * widget is a DOM widget. Call after construction and whenever the interior
   * widget might change (e.g. reconnection).
   *
   * Only one of {adapter, interior widget} is active in `domWidgetStore` at a
   * time.  The adapter is registered and the interior is deactivated, so
   * `DomWidgets.vue` never mounts two `DomWidget.vue` instances for the same
   * `HTMLElement`.
   */
  syncDomAdapter(): void {
    const resolved = this.resolve()
    if (!resolved) return

    const interiorWidget = resolved.widget
    const isDom =
      isDOMWidget(interiorWidget) || isComponentWidget(interiorWidget)

    if (isDom && !this.domAdapter) {
      const domWidget = interiorWidget as BaseDOMWidget<object | string>
      const adapter = createPromotedDomWidgetAdapter(
        domWidget,
        this.subgraphNode,
        this
      )
      this.domAdapter = adapter

      const store = useDomWidgetStore()
      // Start invisible — `updateWidgets()` will set `visible: true` on the
      // first canvas draw when the SubgraphNode is in the current graph.
      // This prevents a race where both adapter and interior DomWidget.vue
      // instances try to mount the same HTMLElement during `onMounted`.
      store.registerWidget(adapter, { visible: false })
    } else if (!isDom && this.domAdapter) {
      this.disposeDomAdapter()
    }

    this.syncLayoutSize()
  }

  /**
   * Removes the DOM adapter from the store.
   */
  disposeDomAdapter(): void {
    if (!this.domAdapter) return

    useDomWidgetStore().unregisterWidget(this.domAdapter.id)
    this.domAdapter = undefined
  }

  /**
   * Cleans up all resources held by this slot.
   * Called when the SubgraphNode is removed from the graph.
   */
  dispose(): void {
    this.disposeDomAdapter()
  }

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    // Lazily create the DOM adapter if it wasn't ready at construction time.
    // During deserialization the interior widget may not exist yet when the
    // PromotedWidgetSlot constructor runs, so syncDomAdapter() is retried here
    // on every draw until it succeeds.
    if (!this.domAdapter) {
      this.syncDomAdapter()
    }

    const resolved = this.resolve()

    const concrete = resolved
      ? toConcreteWidget(resolved.widget, resolved.node, false)
      : null

    if (concrete) {
      // Suppress promoted border and disabled state: the purple outline and
      // linked-disabled flag should only apply on the source node inside the
      // subgraph, not on the SubgraphNode.
      const wasPromoted = concrete.promoted
      concrete.promoted = false
      concrete.computedDisabled = false

      concrete.computedHeight = this.computedHeight
      ctx.save()
      ctx.translate(0, this.y - concrete.y)
      concrete.drawWidget(ctx, options)
      ctx.restore()

      concrete.promoted = wasPromoted
    } else {
      this.drawWidgetShape(ctx, options)
      if (options.showText !== false) {
        if (!resolved) ctx.fillStyle = LiteGraph.WIDGET_DISABLED_TEXT_COLOR
        this.drawTruncatingText({
          ctx,
          ...options,
          leftPadding: 0,
          rightPadding: 0
        })
      }
    }
  }

  onClick(options: WidgetEventOptions): void {
    const resolved = this.resolve()
    if (!resolved) return

    const concrete = toConcreteWidget(resolved.widget, resolved.node, false)
    concrete?.onClick(options)
  }
}
