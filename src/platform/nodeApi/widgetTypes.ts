/**
 * `defs.defineWidgetType` — how an input *type* is presented.
 *
 * Distinct from `node.widgets.mount`, which puts one widget on one node. This
 * says "every input declared as `MTB_COLOR` looks like this", which is what
 * `getCustomWidgets` did.
 *
 * It is load-bearing rather than decorative. The host decides widget-vs-socket
 * by a single lookup: `addInputSocket` returns early *if* a constructor exists
 * for the type and `addInputWidget` returns early if it *doesn't*, so they are
 * exact complements. An unregistered type does not fall back to a plain
 * widget — the input silently becomes a **socket**, which changes the
 * serialized `inputs` array and drops the value from `widgets_values`. Three
 * packs had to be refused outright over this.
 *
 * The renderer is handed a container and a value accessor, not a node handle.
 * Widgets are built while the node is still being constructed — before it has
 * joined a graph — so a handle resolved then would already be dead, which is
 * the same reason `onCreated` waits for `onAdded`.
 */
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useWidgetStore } from '@/stores/widgetStore'

import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
import type { Unsubscribe } from './widgetHandle'

/** What a pack-declared widget can hold. */
export type WidgetTypeData = string | number | boolean | object | null

/**
 * Reading and writing the widget's value, for the renderer to bind to.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface WidgetTypeValue {
  get(): WidgetTypeData
  set(value: WidgetTypeData): void
  /** Notified when the value changes for any other reason — a workflow load. */
  onChange(listener: (value: WidgetTypeData) => void): Unsubscribe
}

export interface WidgetTypeContext {
  /** A frozen snapshot of the input declaration's current options. */
  getOptions(): Readonly<Record<string, unknown>>
  /**
   * Runs while the widget's owning node belongs to a graph.
   *
   * Widget constructors run before a node has an id or graph, so a node handle
   * cannot be supplied directly to `render`. The listener runs after the node
   * joins a graph and tears down when it leaves.
   */
  onNodeReady(listener: (node: NodeHandle) => Unsubscribe | void): Unsubscribe
}

export interface WidgetTypeDef {
  /** Used when the definition supplies none. */
  readonly defaultValue?: WidgetTypeData
  /** Height in pixels. Omit to size to content. */
  readonly height?: number
  /** Smallest width the control needs, in pixels. */
  readonly minWidth?: number
  /** Smallest height the control needs, in pixels. */
  readonly minHeight?: number
  /**
   * Whether the value is saved and sent. Defaults to `true`: this widget holds
   * a real input value, unlike a mounted decoration.
   */
  readonly serialize?: boolean
  /**
   * Fills the container. Return a teardown if the control owns listeners,
   * timers or observers.
   *
   * `name` is the input being rendered — controls commonly label themselves
   * with it, which a type-level renderer otherwise has no way to know.
   */
  render(
    container: HTMLElement,
    value: WidgetTypeValue,
    name: string,
    context: WidgetTypeContext
  ): Unsubscribe | void
}

/** A default is per-type; each widget needs its own copy of an object one. */
function copyDefault(value: WidgetTypeData | undefined): WidgetTypeData {
  if (value === undefined) return ''
  if (typeof value !== 'object') return value
  return structuredClone(value)
}

function createWidgetTypeContext(
  node: LGraphNode,
  handleFor: (node: LGraphNode) => NodeHandle,
  getOptions: () => object
): WidgetTypeContext {
  type Subscription = {
    listener: (node: NodeHandle) => Unsubscribe | void
    teardown?: Unsubscribe
  }

  const subscriptions = new Set<Subscription>()
  const deactivate = (subscription: Subscription) => {
    subscription.teardown?.()
    subscription.teardown = undefined
  }
  const activate = (subscription: Subscription) => {
    deactivate(subscription)
    subscription.teardown = subscription.listener(handleFor(node)) ?? undefined
  }

  const onAdded = node.onAdded
  node.onAdded = function (graph) {
    onAdded?.call(this, graph)
    for (const subscription of subscriptions) activate(subscription)
  }

  const onRemoved = node.onRemoved
  node.onRemoved = function () {
    for (const subscription of subscriptions) deactivate(subscription)
    onRemoved?.call(this)
  }

  return Object.freeze({
    getOptions: () => Object.freeze({ ...getOptions() }),
    onNodeReady(listener: (node: NodeHandle) => Unsubscribe | void) {
      const subscription = { listener }
      subscriptions.add(subscription)
      if (node.graph) activate(subscription)
      return () => {
        subscriptions.delete(subscription)
        deactivate(subscription)
      }
    }
  })
}

const declaredWidgetTypes = new Map<string, ComfyWidgetConstructor>()

export function constructDeclaredWidget(
  node: LGraphNode,
  type: string,
  name: string,
  options: object,
  value: unknown
): ReturnType<ComfyWidgetConstructor> | undefined {
  const constructor = declaredWidgetTypes.get(type)
  if (!constructor) return undefined
  const inputData = [
    type,
    { ...options, default: value }
  ] as Parameters<ComfyWidgetConstructor>[2]
  return constructor(node, name, inputData, undefined as never)
}

export function createWidgetTypeRegistrar(
  handleFor: (node: LGraphNode) => NodeHandle
) {
  return (type: string, def: WidgetTypeDef): Unsubscribe => {
    if (!type.trim()) {
      throw new ComfyApiError('A widget type name cannot be empty.')
    }

    const constructor: ComfyWidgetConstructor = (
      node: LGraphNode,
      inputName: string,
      inputData: unknown
    ) => {
      const container = document.createElement('div')
      container.style.width = '100%'
      if (def.height !== undefined) container.style.height = `${def.height}px`

      // The definition's own default wins over the type's, so a node can
      // declare a starting colour and still be drawn by the pack's control.
      const declaredOptions =
        Array.isArray(inputData) &&
        inputData[1] !== null &&
        typeof inputData[1] === 'object' &&
        !Array.isArray(inputData[1])
          ? (inputData[1] as Record<string, unknown>)
          : {}
      const declared = declaredOptions.default as WidgetTypeData | undefined
      // A DOM widget's `value` is backed by these accessors, not a field, so
      // the cell has to exist before the widget does — assigning `.value`
      // without them is silently a no-op.
      //
      // Copied per widget: a default is declared once for the type, and an
      // object default handed out by reference would be shared by every node
      // of that type. A curve editor mutates its points in place, so dragging
      // one node's curve moved every other node's too.
      let current: WidgetTypeData = copyDefault(declared ?? def.defaultValue)

      const widget = node.addDOMWidget(inputName, type, container, {
        ...declaredOptions,
        serialize: def.serialize ?? true,
        getValue: () => current,
        setValue: (value: unknown) => {
          current = value as WidgetTypeData
        }
      } as never)
      widget.serialize = def.serialize ?? true

      const listeners = new Set<(value: WidgetTypeData) => void>()
      const previous = widget.callback
      widget.callback = function (this: unknown, value, ...rest) {
        previous?.apply(this as never, [value, ...rest] as never)
        for (const listener of listeners) listener(value as WidgetTypeData)
      } as typeof widget.callback

      const teardown = def.render(
        container,
        {
          get: () => widget.value as WidgetTypeData,
          // The widget's own setter stores through `setValue` and then fires
          // the callback, so calling it here too would notify twice.
          set: (value) => {
            widget.value = value as typeof widget.value
          },
          onChange: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          }
        },
        inputName,
        createWidgetTypeContext(node, handleFor, () => widget.options)
      )

      if (teardown) {
        const onRemove = widget.onRemove
        widget.onRemove = function (this: unknown) {
          onRemove?.call(this)
          teardown()
        }
      }

      return { widget, minWidth: def.minWidth, minHeight: def.minHeight }
    }

    declaredWidgetTypes.set(type, constructor)
    useWidgetStore().registerCustomWidgets({ [type]: constructor })
    return () => {
      if (declaredWidgetTypes.get(type) !== constructor) return
      declaredWidgetTypes.delete(type)
      useWidgetStore().unregisterCustomWidget(type)
    }
  }
}
