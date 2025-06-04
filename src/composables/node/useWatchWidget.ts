import type { LGraphNode } from '@comfyorg/litegraph'
import { computedWithControl } from '@vueuse/core'
import { type ComputedRef, ref } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'

export interface UseComputedWithWidgetWatchOptions {
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

  // Create a reactive trigger based on widget values
  const widgetValues = ref<Record<string, any>>({})

  // Initialize widget observers
  if (node.widgets) {
    const widgetsToObserve = widgetNames
      ? node.widgets.filter((widget) => widgetNames.includes(widget.name))
      : node.widgets

    // Initialize current values
    const currentValues: Record<string, any> = {}
    widgetsToObserve.forEach((widget) => {
      currentValues[widget.name] = widget.value
    })
    widgetValues.value = currentValues

    widgetsToObserve.forEach((widget) => {
      widget.callback = useChainCallback(widget.callback, () => {
        // Update the reactive widget values
        widgetValues.value = {
          ...widgetValues.value,
          [widget.name]: widget.value
        }

        // Optionally trigger a canvas redraw
        if (triggerCanvasRedraw) {
          node.graph?.setDirtyCanvas(true, true)
        }
      })
    })
  }

  // Returns a function that creates a computed that responds to widget changes.
  // The computed will be re-evaluated whenever any observed widget changes.
  return <T>(computeFn: () => T): ComputedRef<T> => {
    return computedWithControl(widgetValues, computeFn)
  }
}
