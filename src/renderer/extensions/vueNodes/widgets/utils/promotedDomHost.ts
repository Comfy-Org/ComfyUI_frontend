import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import {
  ComponentWidgetImpl,
  DOMWidgetImpl,
  isComponentWidget,
  isDOMWidget
} from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { createPromotedMultilineWidget } from './multilineTextarea'
import {
  addSourceCallbackSync,
  claimOrCloneHostElement,
  installInPlaceMirror,
  isHostNodeSettled
} from './promotedHostPrimitives'
import type { PromotedHostWidgetContext } from './promotedHostPrimitives'
import {
  attachMarkdownHostEditing,
  isMarkdownHostElement
} from './promotedMarkdownHost'

export type { PromotedHostWidgetContext } from './promotedHostPrimitives'

function createPromotedComponentWidget(context: PromotedHostWidgetContext) {
  const { subgraphNode, input, widgetId, sourceWidget } = context
  const widgetStore = useWidgetValueStore()
  if (!isComponentWidget(sourceWidget)) return undefined

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

function createGenericPromotedDomWidget(
  context: PromotedHostWidgetContext
): IBaseWidget | undefined {
  const { input, widgetId, sourceWidget } = context
  if (!isDOMWidget(sourceWidget)) return undefined
  const widgetStore = useWidgetValueStore()
  const sourceElement = sourceWidget.element

  const {
    element,
    shared,
    release: releaseClaim
  } = claimOrCloneHostElement(sourceElement)
  const isValueBearing = !shared && 'value' in element
  const cloneTextarea = shared ? null : element.querySelector('textarea')
  let refreshClonePreview: (() => void) | undefined
  const reflectValueToElement = (value: string) => {
    if (shared) return
    if (isValueBearing) (element as HTMLInputElement).value = value
    else if (cloneTextarea) {
      cloneTextarea.value = value
      refreshClonePreview?.()
    }
  }
  reflectValueToElement(sourceWidget.value as string)

  const widget = new DOMWidgetImpl<HTMLElement, string>({
    node: context.subgraphNode,
    name: input.name,
    type: sourceWidget.type,
    element,
    options: {
      hideOnZoom: sourceWidget.options.hideOnZoom ?? true,
      getValue: () => sourceWidget.value as string,
      setValue: (value: string) => {
        sourceWidget.value = value
        reflectValueToElement(value)
        widgetStore.setValue(widgetId, value)
      },
      getHeight: () => sourceWidget.computedHeight ?? ''
    }
  })
  const syncToHost = () => {
    const value = sourceWidget.value as string
    widgetStore.setValue(widgetId, value)
    reflectValueToElement(value)
  }
  // The interior widget's own listeners write direct element edits to
  // sourceWidget, bypassing the host value setter; mirror them into the host
  // store and clone from the post-callback interior value.
  const inputListenerController = new AbortController()
  sourceWidget.element.addEventListener('input', syncToHost, {
    signal: inputListenerController.signal
  })
  // Host-side edits on the clone never reach the interior element's own
  // listeners; writing the source value replays them through the callback
  // sync and back to the interior element.
  if (isValueBearing)
    element.addEventListener(
      'input',
      () => {
        sourceWidget.value = (element as HTMLInputElement).value
      },
      { signal: inputListenerController.signal }
    )
  if (cloneTextarea && isMarkdownHostElement(element)) {
    attachMarkdownHostEditing(
      {
        sourceWidget,
        getSourceElement: () => sourceWidget.element,
        element,
        cloneTextarea,
        signal: inputListenerController.signal
      },
      (refresh) => {
        refreshClonePreview = refresh
      }
    )
  }
  // Streaming display panels update by mutating their subtree in place, with
  // no value writes or input events for the syncs above to catch.
  const disposeMirror =
    !shared && !isValueBearing && !cloneTextarea
      ? installInPlaceMirror(sourceElement, element)
      : undefined
  // Setter-driven changes (a button assigning its value) fire no input event;
  // chain the same sync onto the interior callback the setter calls.
  const releaseSourceSync = addSourceCallbackSync(sourceWidget, syncToHost)
  widget.onRemove = useChainCallback(widget.onRemove, () => {
    releaseClaim()
    disposeMirror?.()
    inputListenerController.abort()
    releaseSourceSync()
  })
  useDomWidgetStore().registerWidget(widget)

  return widget
}

/**
 * Builds the host widget for a promoted DOM- or component-backed source
 * widget. Textareas keep the store-backed host-owned element; component
 * widgets reuse the interior component; any other DOM widget claims and
 * shares the interior element for the first host (so in-place DOM updates
 * stay live on it), while later hosts for the same element get clones kept
 * in sync through the source widget's value, callbacks, and a DOM mutation
 * mirror. The live content renders on the host node instead of staying
 * hidden in the interior node's overlay. The widget is registered with the
 * DOM widget store so the canvas-mode overlay positions it on the host row;
 * in Vue-nodes mode the overlay is not mounted and the row owns the element
 * instead. Returns undefined to fall back to the store-backed projection.
 */
export function createPromotedDomWidget(
  context: PromotedHostWidgetContext
): IBaseWidget | undefined {
  const { subgraphNode, sourceWidget } = context

  if (
    isDOMWidget(sourceWidget) &&
    sourceWidget.element instanceof HTMLTextAreaElement
  ) {
    return createPromotedMultilineWidget(context)
  }

  if (!isDOMWidget(sourceWidget) && !isComponentWidget(sourceWidget))
    return undefined

  if (!isHostNodeSettled(subgraphNode)) return undefined

  return isComponentWidget(sourceWidget)
    ? createPromotedComponentWidget(context)
    : createGenericPromotedDomWidget(context)
}
