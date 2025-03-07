/**
 * Stores all DOM widgets that are used in the canvas.
 */
import { defineStore } from 'pinia'
import { markRaw, ref } from 'vue'

import type { PositionConfig } from '@/composables/element/useAbsolutePosition'
import type { DOMWidget } from '@/scripts/domWidget'

export interface DomWidgetState extends PositionConfig {
  visible: boolean
  zIndex: number
}

export const useDomWidgetStore = defineStore('domWidget', () => {
  const widgetStates = ref<Map<string, DomWidgetState>>(new Map())

  // Map to reference actual widget instances
  // Widgets are stored as raw values to avoid reactivity issues
  const widgetInstances = ref(
    new Map<string, DOMWidget<HTMLElement, object | string>>()
  )

  // Register a widget with the store
  const registerWidget = <T extends HTMLElement, V extends object | string>(
    widget: DOMWidget<T, V>
  ) => {
    widgetInstances.value.set(
      widget.id,
      markRaw(widget as unknown as DOMWidget<HTMLElement, object | string>)
    )
    widgetStates.value.set(widget.id, {
      visible: true,
      zIndex: 0,
      pos: [0, 0],
      size: [0, 0]
    })
  }

  // Unregister a widget from the store
  const unregisterWidget = (widgetId: string) => {
    widgetInstances.value.delete(widgetId)
    widgetStates.value.delete(widgetId)
  }

  return {
    widgetStates,
    widgetInstances,
    registerWidget,
    unregisterWidget
  }
})
