import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { INodeInputSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import { forwardMiddleButtonToCanvas } from '@/renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas'
import { app } from '@/scripts/app'
import {
  ComponentWidgetImpl,
  DOMWidgetImpl,
  isComponentWidget,
  isDOMWidget
} from '@/scripts/domWidget'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

const TRACKPAD_DETECTION_THRESHOLD = 50

/** Creates the `<textarea>` element backing a `customtext` multiline widget. */
export function createMultilineInputElement(
  value: string,
  placeholder: string
): HTMLTextAreaElement {
  const element = document.createElement('textarea')
  element.className = 'comfy-multiline-input'
  element.dataset.testid = 'dom-widget-textarea'
  element.value = value
  element.placeholder = placeholder
  element.spellcheck = useSettingStore().get('Comfy.TextareaWidget.Spellcheck')
  return element
}

/**
 * Wires textarea value propagation, trackpad gestures, and middle-button canvas
 * panning onto a `customtext` DOM widget, torn down via the widget's `onRemove`.
 */
export function bindMultilineTextareaWidget(
  widget: BaseDOMWidget<string>,
  element: HTMLTextAreaElement
): void {
  const controller = new AbortController()
  const { signal } = controller

  element.addEventListener(
    'input',
    () => {
      widget.value = element.value
      widget.callback?.(widget.value)
    },
    { signal }
  )

  forwardMiddleButtonToCanvas(element, signal)

  element.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      const gesturesEnabled = useSettingStore().get(
        'LiteGraph.Pointer.TrackpadGestures'
      )
      const deltaX = event.deltaX
      const deltaY = event.deltaY

      const canScrollY = element.scrollHeight > element.clientHeight
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY)

      // Prevent pinch zoom from zooming the page
      if (event.ctrlKey) {
        event.preventDefault()
        event.stopPropagation()
        app.canvas.processMouseWheel(event)
        return
      }

      // Detect if this is likely a trackpad gesture vs mouse wheel
      // Trackpads usually have deltaX or smaller deltaY values (< TRACKPAD_DETECTION_THRESHOLD)
      // Mouse wheels typically have larger discrete deltaY values (>= TRACKPAD_DETECTION_THRESHOLD)
      const isLikelyTrackpad =
        Math.abs(deltaX) > 0 || Math.abs(deltaY) < TRACKPAD_DETECTION_THRESHOLD

      // Trackpad gestures: when enabled, trackpad panning goes to canvas
      if (gesturesEnabled && isLikelyTrackpad) {
        event.preventDefault()
        event.stopPropagation()
        app.canvas.processMouseWheel(event)
        return
      }

      // When gestures disabled: horizontal always goes to canvas (no horizontal scroll in textarea)
      if (isHorizontal) {
        event.preventDefault()
        event.stopPropagation()
        app.canvas.processMouseWheel(event)
        return
      }

      // Vertical scrolling when gestures disabled: let textarea scroll if scrollable
      if (canScrollY) {
        event.stopPropagation()
        return
      }

      // If textarea can't scroll vertically, pass to canvas
      event.preventDefault()
      app.canvas.processMouseWheel(event)
    },
    { signal }
  )

  widget.onRemove = useChainCallback(widget.onRemove, () => {
    controller.abort()
  })
}

export interface PromotedMultilineWidgetContext {
  subgraphNode: LGraphNode
  input: INodeInputSlot
  widgetId: WidgetId
  sourceWidget: Readonly<IBaseWidget>
}

/**
 * Builds the promoted textarea as a host-owned DOM widget, registered directly
 * with the DOM widget store since `SubgraphNode.widgets` is a projected getter.
 * Returns undefined to fall back to the store-backed projection.
 */
export function createPromotedMultilineWidget(
  context: PromotedMultilineWidgetContext
): IBaseWidget | undefined {
  const { subgraphNode, input, widgetId, sourceWidget } = context

  // Only materialize once the host node is settled in its graph; clone/configure
  // run with a transient id and would leak duplicate DOM widgets.
  const graph = subgraphNode.graph
  if (!graph || graph.getNodeById(subgraphNode.id) !== subgraphNode)
    return undefined
  if (!isDOMWidget(sourceWidget)) return undefined
  if (!(sourceWidget.element instanceof HTMLTextAreaElement)) return undefined

  const widgetStore = useWidgetValueStore()

  const readValue = (): string => {
    const value = widgetStore.getWidget(widgetId)?.value
    return typeof value === 'string' ? value : ''
  }

  const element = createMultilineInputElement(
    readValue(),
    input.label ?? input.name
  )

  const widget = new DOMWidgetImpl<HTMLTextAreaElement, string>({
    node: subgraphNode,
    name: input.name,
    type: 'customtext',
    element,
    options: {
      hideOnZoom: true,
      minNodeSize: [400, 200],
      getValue: readValue,
      setValue: (value: string) => {
        element.value = value
        widgetStore.setValue(widgetId, value)
      }
    }
  })

  bindMultilineTextareaWidget(widget, element)
  useDomWidgetStore().registerWidget(widget)

  return widget
}

/**
 * Builds the host widget for a promoted DOM-backed source widget. Textareas
 * keep the store-backed host-owned element; any other DOM widget reuses the
 * interior element and any component widget reuses the interior component, so
 * the live content renders on the host node instead of staying hidden in the
 * interior node's overlay. The widget is registered with the DOM widget store
 * so the canvas-mode overlay positions it on the host row; in Vue-nodes mode
 * the overlay is not mounted and the row owns the element instead. Returns
 * undefined to fall back to the store-backed projection.
 */
type SourceCallbackRegistration = {
  syncs: Set<() => void>
  previousCallback: IBaseWidget['callback']
  dispatcher: IBaseWidget['callback']
}

// Multiple promoted hosts can resolve the same interior widget from a shared
// Subgraph definition, so the callback wrapper is shared and the original
// callback is restored only when the last host releases its sync.
const sourceCallbackSyncs = new WeakMap<
  IBaseWidget,
  SourceCallbackRegistration
>()

function addSourceCallbackSync(
  source: IBaseWidget,
  sync: () => void
): () => void {
  let registration = sourceCallbackSyncs.get(source)
  if (!registration) {
    const syncs = new Set<() => void>()
    const previousCallback = source.callback
    const dispatcher = useChainCallback(previousCallback, () => {
      for (const fn of syncs) fn()
    })
    registration = { syncs, previousCallback, dispatcher }
    sourceCallbackSyncs.set(source, registration)
    source.callback = dispatcher
  }
  const activeRegistration = registration
  activeRegistration.syncs.add(sync)
  let released = false
  return () => {
    if (released) return
    released = true
    activeRegistration.syncs.delete(sync)
    if (activeRegistration.syncs.size === 0) {
      if (source.callback === activeRegistration.dispatcher) {
        source.callback = activeRegistration.previousCallback
      }
      sourceCallbackSyncs.delete(source)
    }
  }
}

export function createPromotedDomWidget(
  context: PromotedMultilineWidgetContext
): IBaseWidget | undefined {
  const { subgraphNode, input, widgetId, sourceWidget } = context

  if (
    isDOMWidget(sourceWidget) &&
    sourceWidget.element instanceof HTMLTextAreaElement
  ) {
    return createPromotedMultilineWidget(context)
  }

  if (!isDOMWidget(sourceWidget) && !isComponentWidget(sourceWidget))
    return undefined

  // Only materialize once the host node is settled in its graph; clone/configure
  // run with a transient id and would detach the shared element from its
  // owner.
  const graph = subgraphNode.graph
  if (!graph || graph.getNodeById(subgraphNode.id) !== subgraphNode)
    return undefined

  const widgetStore = useWidgetValueStore()
  if (isComponentWidget(sourceWidget)) {
    const widget = new ComponentWidgetImpl<string | object>({
      node: subgraphNode,
      name: input.name,
      component: sourceWidget.component,
      inputSpec: sourceWidget.inputSpec,
      props: sourceWidget.props,
      type: sourceWidget.type,
      options: {
        hideOnZoom: sourceWidget.options.hideOnZoom,
        getMinHeight: sourceWidget.options.getMinHeight,
        getValue: () => {
          const stored = widgetStore.getWidget(widgetId)?.value
          return typeof stored === 'string' ||
            (stored != null && typeof stored === 'object')
            ? stored
            : ''
        },
        setValue: (value: string | object) => {
          widgetStore.setValue(widgetId, value)
        }
      }
    })
    useDomWidgetStore().registerWidget(widget)
    return widget
  }

  const widget = new DOMWidgetImpl<HTMLElement, string>({
    node: subgraphNode,
    name: input.name,
    type: sourceWidget.type,
    element: sourceWidget.element,
    options: {
      hideOnZoom: sourceWidget.options.hideOnZoom ?? true,
      getValue: () => sourceWidget.value as string,
      setValue: (value: string) => {
        sourceWidget.value = value
        widgetStore.setValue(widgetId, value)
      },
      getHeight: () => sourceWidget.computedHeight ?? ''
    }
  })
  // The interior widget's own listeners write direct element edits to
  // sourceWidget, bypassing the host value setter; mirror them into the host
  // store from the post-callback interior value.
  const inputListenerController = new AbortController()
  sourceWidget.element.addEventListener(
    'input',
    () => widgetStore.setValue(widgetId, sourceWidget.value),
    { signal: inputListenerController.signal }
  )
  // Setter-driven changes (a button assigning its value) never reach the
  // element; chain the same sync onto the interior callback the setter fires.
  const releaseSourceSync = addSourceCallbackSync(sourceWidget, () => {
    widgetStore.setValue(widgetId, sourceWidget.value)
  })
  widget.onRemove = useChainCallback(widget.onRemove, () => {
    inputListenerController.abort()
    releaseSourceSync()
  })
  useDomWidgetStore().registerWidget(widget)

  return widget
}
