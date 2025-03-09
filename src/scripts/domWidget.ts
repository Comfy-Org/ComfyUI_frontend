import { LGraphNode } from '@comfyorg/litegraph'
import type {
  ICustomWidget,
  IWidgetOptions
} from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { app } from '@/scripts/app'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { generateUUID } from '@/utils/formatUtil'

export interface DOMWidget<T extends HTMLElement, V extends object | string>
  extends ICustomWidget<T> {
  // ICustomWidget properties
  type: 'custom'
  element: T
  options: DOMWidgetOptions<T, V>
  value: V
  /**
   * @deprecated Legacy property used by some extensions for customtext
   * (textarea) widgets. Use `element` instead as it provides the same
   * functionality and works for all DOMWidget types.
   */
  inputEl?: T
  callback?: (value: V) => void
  // DOMWidget properties
  /** The unique ID of the widget. */
  id: string
  /** The node that the widget belongs to. */
  node: LGraphNode
  /** Whether the widget is visible. */
  isVisible(): boolean
}

export interface DOMWidgetOptions<
  T extends HTMLElement,
  V extends object | string
> extends IWidgetOptions {
  hideOnZoom?: boolean
  selectOn?: string[]
  onHide?: (widget: DOMWidget<T, V>) => void
  getValue?: () => V
  setValue?: (value: V) => void
  getMinHeight?: () => number
  getMaxHeight?: () => number
  getHeight?: () => string | number
  onDraw?: (widget: DOMWidget<T, V>) => void
  /**
   * @deprecated Use `afterResize` instead. This callback is a legacy API
   * that fires before resize happens, but it is no longer supported. Now it
   * fires after resize happens.
   * The resize logic has been upstreamed to litegraph in
   * https://github.com/Comfy-Org/ComfyUI_frontend/pull/2557
   */
  beforeResize?: (this: DOMWidget<T, V>, node: LGraphNode) => void
  afterResize?: (this: DOMWidget<T, V>, node: LGraphNode) => void
}

export class DOMWidgetImpl<T extends HTMLElement, V extends object | string>
  implements DOMWidget<T, V>
{
  readonly type: 'custom'
  readonly name: string
  readonly element: T
  readonly options: DOMWidgetOptions<T, V>
  computedHeight?: number
  callback?: (value: V) => void

  readonly id: string
  readonly node: LGraphNode
  mouseDownHandler?: (event: MouseEvent) => void

  constructor(obj: {
    id: string
    node: LGraphNode
    name: string
    type: string
    element: T
    options: DOMWidgetOptions<T, V>
  }) {
    // @ts-expect-error custom widget type
    this.type = obj.type
    this.name = obj.name
    this.element = obj.element
    this.options = obj.options

    this.id = obj.id
    this.node = obj.node

    if (this.element.blur) {
      this.mouseDownHandler = (event) => {
        if (!this.element.contains(event.target as HTMLElement)) {
          this.element.blur()
        }
      }
      document.addEventListener('mousedown', this.mouseDownHandler)
    }
  }

  get value(): V {
    return this.options.getValue?.() ?? ('' as V)
  }

  set value(v: V) {
    this.options.setValue?.(v)
    this.callback?.(this.value)
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
    if (this.mouseDownHandler) {
      document.removeEventListener('mousedown', this.mouseDownHandler)
    }
    this.element.remove()
    useDomWidgetStore().unregisterWidget(this.id)
  }
}

LGraphNode.prototype.addDOMWidget = function <
  T extends HTMLElement,
  V extends object | string
>(
  this: LGraphNode,
  name: string,
  type: string,
  element: T,
  options: DOMWidgetOptions<T, V> = {}
): DOMWidget<T, V> {
  options = { hideOnZoom: true, selectOn: ['focus', 'click'], ...options }

  const { nodeData } = this.constructor
  const tooltip = nodeData?.inputs?.[name]?.tooltip
  if (tooltip && !element.title) {
    element.title = tooltip
  }
  // Note: Before `LGraphNode.configure` is called, `this.id` is always `-1`.
  const widget = new DOMWidgetImpl({
    id: generateUUID(),
    node: this,
    name,
    type,
    element,
    options
  })

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

  // Ensure selectOn exists before iteration
  const selectEvents = options.selectOn ?? ['focus', 'click']
  for (const evt of selectEvents) {
    element.addEventListener(evt, () => {
      app.canvas.selectNode(this)
      app.canvas.bringToFront(this)
    })
  }

  this.addCustomWidget(widget)

  this.onRemoved = useChainCallback(this.onRemoved, () => {
    widget.onRemove()
  })

  this.onResize = useChainCallback(this.onResize, () => {
    options.beforeResize?.call(widget, this)
    options.afterResize?.call(widget, this)
  })

  useDomWidgetStore().registerWidget(widget)

  return widget
}
