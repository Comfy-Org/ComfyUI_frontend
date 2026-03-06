import { computedWithControl } from '@vueuse/core'
import { ref } from 'vue'
import type { ComputedRef } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

interface UseComputedWithWidgetWatchOptions {
  /**
   * Names of widgets to observe for changes.
   * If not provided, all widgets will be observed.
   */
  widgetNames?: string[]

  /**
   * Whether to trigger a canvas redraw when widget values change.
   * @default false
   */
  triggerCanvasRedraw?: boolean
}

/**
 * A composable that creates a computed that has a node's widget values as a dependencies.
 * Essentially `computedWithControl` (https://vueuse.org/shared/computedWithControl/) where
 * the explicitly defined extra dependencies are LGraphNode widgets.
 *
 * @param node - The LGraphNode whose widget values are to be watched
 * @param options - Configuration options for the watcher
 * @returns A function to create computed that responds to widget changes
 *
 * @example
 * ```ts
 * const computedWithWidgetWatch = useComputedWithWidgetWatch(node, {
 *   widgetNames: ['width', 'height'],
 *   triggerCanvasRedraw: true
 * })
 *
 * const dynamicPrice = computedWithWidgetWatch(() => {
 *   return calculatePrice(node)
 * })
 * ```
 */
export const useComputedWithWidgetWatch = (
  node: LGraphNode,
  options: UseComputedWithWidgetWatchOptions = {}
) => {
  const { widgetNames, triggerCanvasRedraw = false } = options

  const widgetValues = ref<Record<string, unknown>>({})

  if (node.widgets) {
    const widgetsToObserve = widgetNames
      ? node.widgets.filter((widget) => widgetNames.includes(widget.name))
      : node.widgets

    const currentValues: Record<string, unknown> = {}
    widgetsToObserve.forEach((widget) => {
      currentValues[widget.name] = widget.value
    })
    widgetValues.value = currentValues

    widgetsToObserve.forEach((widget) => {
      widget.callback = useChainCallback(widget.callback, () => {
        widgetValues.value = {
          ...widgetValues.value,
          [widget.name]: widget.value
        }

        if (triggerCanvasRedraw) {
          node.graph?.setDirtyCanvas(true, true)
        }
      })
    })
    if (widgetNames && widgetNames.length > widgetsToObserve.length) {
      const indexesToObserve = widgetNames
        .map((name) =>
          widgetsToObserve.some((w) => w.name == name)
            ? -1
            : node.inputs.findIndex((i) => i.name == name)
        )
        .filter((i) => i >= 0)
      node.onConnectionsChange = useChainCallback(
        node.onConnectionsChange,
        (_type: unknown, index: number, isConnected: boolean) => {
          if (!indexesToObserve.includes(index)) return
          widgetValues.value = {
            ...widgetValues.value,
            [indexesToObserve[index]]: isConnected
          }
          if (triggerCanvasRedraw) {
            node.graph?.setDirtyCanvas(true, true)
          }
        }
      )
    }
  }

  return <T>(computeFn: () => T): ComputedRef<T> => {
    return computedWithControl(widgetValues, computeFn)
  }
}
