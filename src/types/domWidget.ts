import type { Component } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

export interface BaseDOMWidget<
  V extends object | string = object | string
> extends IBaseWidget<V, string, DOMWidgetOptions<V>> {
  // ICustomWidget properties
  type: string
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
  /** The margin of the widget. */
  margin: number
}

/**
 * A DOM widget that wraps a custom HTML element as a litegraph widget.
 */
export interface DOMWidget<
  T extends HTMLElement,
  V extends object | string
> extends BaseDOMWidget<V> {
  element: T
  /**
   * @deprecated Legacy property used by some extensions for customtext
   * (textarea) widgets. Use {@link element} instead as it provides the same
   * functionality and works for all DOMWidget types.
   */
  inputEl?: T
}

/**
 * Additional props that can be passed to component widgets.
 * These are in addition to the standard props that are always provided:
 * - modelValue: The widget's value (handled by v-model)
 * - widget: Reference to the widget instance
 * - onUpdate:modelValue: The update handler for v-model
 */
export type ComponentWidgetCustomProps = Record<string, unknown>

/**
 * Standard props that are handled separately by DomWidget.vue and should be
 * omitted when defining custom props for component widgets
 */
export type ComponentWidgetStandardProps =
  | 'modelValue'
  | 'widget'
  | 'onUpdate:modelValue'

/**
 * A DOM widget that wraps a Vue component as a litegraph widget.
 */
export interface ComponentWidget<
  V extends object | string,
  P extends ComponentWidgetCustomProps = ComponentWidgetCustomProps
> extends BaseDOMWidget<V> {
  readonly component: Component
  readonly inputSpec: InputSpec
  readonly props?: P
}

export interface DOMWidgetOptions<
  V extends object | string
> extends IWidgetOptions {
  /**
   * Whether to render a placeholder rectangle when zoomed out.
   */
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
