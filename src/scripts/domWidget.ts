import { LGraphNode } from '@comfyorg/litegraph'
import type {
  ICustomWidget,
  IWidget,
  IWidgetOptions
} from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'
import { type Component, toRaw } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { generateUUID } from '@/utils/formatUtil'

export interface BaseDOMWidget<V extends object | string>
  extends ICustomWidget {
  // ICustomWidget properties
  type: 'custom'
  options: DOMWidgetOptions<V>
  value: V
  callback?: (value: V) => void

  // BaseDOMWidget properties
  /** The unique ID of the widget. */
  readonly id: string
  /** The node that the widget belongs to. */
  readonly node: LGraphNode
  /** Whether the widget is visible. */
  isVisible(): boolean
}

/**
 * A DOM widget that wraps a custom HTML element as a litegraph widget.
 */
export interface DOMWidget<T extends HTMLElement, V extends object | string>
  extends BaseDOMWidget<V> {
  element: T
  /**
   * @deprecated Legacy property used by some extensions for customtext
   * (textarea) widgets. Use {@link element} instead as it provides the same
   * functionality and works for all DOMWidget types.
   */
  inputEl?: T
}

/**
 * A DOM widget that wraps a Vue component as a litegraph widget.
 */
export interface ComponentWidget<V extends object | string>
  extends BaseDOMWidget<V> {
  readonly component: Component
  readonly inputSpec: InputSpec
}

export interface DOMWidgetOptions<V extends object | string>
  extends IWidgetOptions {
  hideOnZoom?: boolean
  selectOn?: string[]
  onHide?: (widget: BaseDOMWidget<V>) => void
  getValue?: () => V
  setValue?: (value: V) => void
  getMinHeight?: () => number
  getMaxHeight?: () => number
  getHeight?: () => string | number
  onDraw?: (widget: BaseDOMWidget<V>) => void
  margin?: number
  /**
   * @deprecated Use `afterResize` instead. This callback is a legacy API
   * that fires before resize happens, but it is no longer supported. Now it
   * fires after resize happens.
   * The resize logic has been upstreamed to litegraph in
   * https://github.com/Comfy-Org/ComfyUI_frontend/pull/2557
   */
  beforeResize?: (this: BaseDOMWidget<V>, node: LGraphNode) => void
  afterResize?: (this: BaseDOMWidget<V>, node: LGraphNode) => void
}

export const isDOMWidget = <T extends HTMLElement, V extends object | string>(
  widget: IWidget
): widget is DOMWidget<T, V> => 'element' in widget && !!widget.element

export const isComponentWidget = <V extends object | string>(
  widget: IWidget
): widget is ComponentWidget<V> => 'component' in widget && !!widget.component

abstract class BaseDOMWidgetImpl<V extends object | string>
  implements BaseDOMWidget<V>
{
  readonly type: 'custom'
  readonly name: string
  readonly options: DOMWidgetOptions<V>
  computedHeight?: number
  y: number = 0
  callback?: (value: V) => void

  readonly id: string
  readonly node: LGraphNode

  constructor(obj: {
    id: string
    node: LGraphNode
    name: string
    type: string
    options: DOMWidgetOptions<V>
  }) {
    // @ts-expect-error custom widget type
    this.type = obj.type
    this.name = obj.name
    this.options = obj.options

    this.id = obj.id
    this.node = obj.node
  }

  get value(): V {
    return this.options.getValue?.() ?? ('' as V)
  }

  set value(v: V) {
    this.options.setValue?.(v)
    this.callback?.(this.value)
  }

  isVisible(): boolean {
    return (
      !_.isNil(this.computedHeight) &&
      this.computedHeight > 0 &&
      !['converted-widget', 'hidden'].includes(this.type) &&
      !this.node.collapsed
    )
  }

  draw(): void {
    this.options.onDraw?.(this)
  }

  onRemove(): void {
    useDomWidgetStore().unregisterWidget(this.id)
  }
}

export class DOMWidgetImpl<T extends HTMLElement, V extends object | string>
  extends BaseDOMWidgetImpl<V>
  implements DOMWidget<T, V>
{
  readonly element: T

  constructor(obj: {
    id: string
    node: LGraphNode
    name: string
    type: string
    element: T
    options: DOMWidgetOptions<V>
  }) {
    super(obj)
    this.element = obj.element
  }

  /** Extract DOM widget size info */
  computeLayoutSize(node: LGraphNode) {
    // @ts-expect-error custom widget type
    if (this.type === 'hidden') {
      return {
        minHeight: 0,
        maxHeight: 0,
        minWidth: 0
      }
    }

    const styles = getComputedStyle(this.element)
    let minHeight =
      this.options.getMinHeight?.() ??
      parseInt(styles.getPropertyValue('--comfy-widget-min-height'))
    let maxHeight =
      this.options.getMaxHeight?.() ??
      parseInt(styles.getPropertyValue('--comfy-widget-max-height'))

    let prefHeight: string | number =
      this.options.getHeight?.() ??
      styles.getPropertyValue('--comfy-widget-height')

    if (typeof prefHeight === 'string' && prefHeight.endsWith?.('%')) {
      prefHeight =
        node.size[1] *
        (parseFloat(prefHeight.substring(0, prefHeight.length - 1)) / 100)
    } else {
      prefHeight =
        typeof prefHeight === 'number' ? prefHeight : parseInt(prefHeight)

      if (isNaN(minHeight)) {
        minHeight = prefHeight
      }
    }

    return {
      minHeight: isNaN(minHeight) ? 50 : minHeight,
      maxHeight: isNaN(maxHeight) ? undefined : maxHeight,
      minWidth: 0
    }
  }
}

export class ComponentWidgetImpl<V extends object | string>
  extends BaseDOMWidgetImpl<V>
  implements ComponentWidget<V>
{
  readonly component: Component
  readonly inputSpec: InputSpec

  constructor(obj: {
    id: string
    node: LGraphNode
    name: string
    component: Component
    inputSpec: InputSpec
    options: DOMWidgetOptions<V>
  }) {
    super({
      ...obj,
      type: 'custom'
    })
    this.component = obj.component
    this.inputSpec = obj.inputSpec
  }

  computeLayoutSize() {
    const minHeight = this.options.getMinHeight?.() ?? 50
    const maxHeight = this.options.getMaxHeight?.()
    return {
      minHeight,
      maxHeight,
      minWidth: 0
    }
  }

  serializeValue(): V {
    return toRaw(this.value)
  }
}

export const addWidget = <W extends BaseDOMWidget<object | string>>(
  node: LGraphNode,
  widget: W
) => {
  node.addCustomWidget(widget)
  node.onRemoved = useChainCallback(node.onRemoved, () => {
    widget.onRemove?.()
  })

  node.onResize = useChainCallback(node.onResize, () => {
    widget.options.beforeResize?.call(widget, node)
    widget.options.afterResize?.call(widget, node)
  })

  useDomWidgetStore().registerWidget(widget)
}

LGraphNode.prototype.addDOMWidget = function <
  T extends HTMLElement,
  V extends object | string
>(
  this: LGraphNode,
  name: string,
  type: string,
  element: T,
  options: DOMWidgetOptions<V> = {}
): DOMWidget<T, V> {
  const widget = new DOMWidgetImpl({
    id: generateUUID(),
    node: this,
    name,
    type,
    element,
    options: { hideOnZoom: true, ...options }
  })
  // Note: Before `LGraphNode.configure` is called, `this.id` is always `-1`.
  addWidget(this, widget as unknown as BaseDOMWidget<object | string>)

  // Workaround for https://github.com/Comfy-Org/ComfyUI_frontend/issues/2493
  // Some custom nodes are explicitly expecting getter and setter of `value`
  // property to be on instance instead of prototype.
  Object.defineProperty(widget, 'value', {
    get(this: DOMWidgetImpl<T, V>): V {
      return this.options.getValue?.() ?? ('' as V)
    },
    set(this: DOMWidgetImpl<T, V>, v: V) {
      this.options.setValue?.(v)
      this.callback?.(this.value)
    }
  })

  return widget
}
