import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  BaseDOMWidget,
  ComponentWidget,
  DOMWidgetOptions
} from '@/scripts/domWidget'
import { isDOMWidget, isComponentWidget } from '@/scripts/domWidget'
import { generateUUID } from '@/utils/formatUtil'

import type { PromotedWidgetSlot } from './PromotedWidgetSlot'

/**
 * Adapts an interior DOM widget for display on a SubgraphNode.
 *
 * When a DOM widget is promoted to a subgraph node, `DomWidgets.vue` positions
 * it using `widget.node.pos` and `widget.y`. This adapter overrides those to
 * reference the SubgraphNode (host) and the PromotedWidgetSlot's y position,
 * so the DOM element renders at the correct location on the parent graph.
 *
 * Only ONE of {adapter, interior widget} should be registered in
 * `domWidgetStore` at a time.  The adapter is registered on creation and the
 * interior widget is deactivated.  On dispose the interior is reactivated.
 * `DomWidgets.vue` therefore only ever sees a single `DomWidget.vue` instance
 * per shared `HTMLElement`, avoiding the "element‑theft" race condition that
 * occurs when two instances try to `appendChild` the same element.
 */
export class PromotedDomWidgetAdapter<
  V extends object | string
> implements BaseDOMWidget<V> {
  // IBaseWidget requires a symbol index signature for Vue reactivity tracking.
  [symbol: symbol]: boolean
  readonly id = generateUUID()
  private readonly inner: BaseDOMWidget<V>
  private readonly hostNode: LGraphNode
  private readonly slot: PromotedWidgetSlot

  constructor(
    inner: BaseDOMWidget<V>,
    hostNode: LGraphNode,
    slot: PromotedWidgetSlot
  ) {
    this.inner = inner
    this.hostNode = hostNode
    this.slot = slot
  }

  get node(): LGraphNode {
    return this.hostNode
  }

  get y(): number {
    return this.slot.y
  }

  set y(_v: number) {
    // Position is managed by the slot; ignore external writes.
  }

  get last_y(): number | undefined {
    return this.slot.last_y
  }

  set last_y(_v: number | undefined) {
    // Managed by the slot.
  }

  get name(): string {
    return this.inner.name
  }

  get type(): string {
    return this.inner.type
  }

  get options(): DOMWidgetOptions<V> {
    return this.inner.options
  }

  get value(): V {
    return this.inner.value
  }

  set value(v: V) {
    this.inner.value = v
  }

  get promoted(): boolean {
    return false
  }

  get margin(): number {
    return this.inner.margin
  }

  get width(): number | undefined {
    return (this.inner as IBaseWidget).width
  }

  get computedHeight(): number | undefined {
    return this.slot.computedHeight
  }

  set computedHeight(v: number | undefined) {
    this.slot.computedHeight = v
  }

  get computedDisabled(): boolean | undefined {
    return (this.inner as IBaseWidget).computedDisabled
  }

  get hidden(): boolean | undefined {
    return (this.inner as IBaseWidget).hidden
  }

  get serialize(): boolean | undefined {
    return false
  }

  isVisible(): boolean {
    return (
      !this.hidden &&
      this.hostNode.isWidgetVisible(this as unknown as IBaseWidget)
    )
  }

  get callback(): BaseDOMWidget<V>['callback'] {
    return this.inner.callback
  }

  set callback(v: BaseDOMWidget<V>['callback']) {
    this.inner.callback = v
  }

  /** The interior DOM widget this adapter wraps. */
  get innerWidget(): BaseDOMWidget<V> {
    return this.inner
  }
}

/**
 * Expose the `element` property so `DomWidget.vue` can access it via
 * the `isDOMWidget` type guard.
 */
Object.defineProperty(PromotedDomWidgetAdapter.prototype, 'element', {
  get(this: PromotedDomWidgetAdapter<object | string>) {
    const inner = this.innerWidget
    if (isDOMWidget(inner)) return inner.element
    return undefined
  },
  enumerable: true,
  configurable: true
})

/**
 * Expose the `component` property so `DomWidget.vue` can access it via
 * the `isComponentWidget` type guard.
 */
Object.defineProperty(PromotedDomWidgetAdapter.prototype, 'component', {
  get(this: PromotedDomWidgetAdapter<object | string>) {
    const inner = this.innerWidget
    if (isComponentWidget(inner)) return inner.component
    return undefined
  },
  enumerable: true,
  configurable: true
})

/**
 * Expose the `inputSpec` property for component widgets.
 */
Object.defineProperty(PromotedDomWidgetAdapter.prototype, 'inputSpec', {
  get(this: PromotedDomWidgetAdapter<object | string>) {
    const inner = this.innerWidget
    if (isComponentWidget(inner))
      return (inner as ComponentWidget<object | string>).inputSpec
    return undefined
  },
  enumerable: true,
  configurable: true
})

/**
 * Expose the `props` property for component widgets.
 */
Object.defineProperty(PromotedDomWidgetAdapter.prototype, 'props', {
  get(this: PromotedDomWidgetAdapter<object | string>) {
    const inner = this.innerWidget
    if (isComponentWidget(inner))
      return (inner as ComponentWidget<object | string>).props
    return undefined
  },
  enumerable: true,
  configurable: true
})
