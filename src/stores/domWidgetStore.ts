/**
 * Stores all DOM widgets that are used in the canvas.
 */
import { defineStore } from 'pinia'
import { type Raw, computed, markRaw, ref } from 'vue'

import type { PositionConfig } from '@/composables/element/useAbsolutePosition'
import type { BaseDOMWidget } from '@/scripts/domWidget'

export interface DomWidgetState extends PositionConfig {
  // Raw widget instance
  widget: Raw<BaseDOMWidget<object | string>>
  visible: boolean
  readonly: boolean
  zIndex: number
  /** If the widget belongs to the current graph/subgraph. */
  active: boolean
}

export const useDomWidgetStore = defineStore('domWidget', () => {
  const widgetStates = ref<Map<string, DomWidgetState>>(new Map())

  const activeWidgetStates = computed(() =>
    [...widgetStates.value.values()].filter((state) => state.active)
  )
  const inactiveWidgetStates = computed(() =>
    [...widgetStates.value.values()].filter((state) => !state.active)
  )

  // Register a widget with the store
  const registerWidget = <V extends object | string>(
    widget: BaseDOMWidget<V>
  ) => {
    widgetStates.value.set(widget.id, {
      widget: markRaw(widget) as unknown as Raw<BaseDOMWidget<object | string>>,
      visible: true,
      readonly: false,
      zIndex: 0,
      pos: [0, 0],
      size: [0, 0],
      active: true
    })
  }

  // Unregister a widget from the store
  const unregisterWidget = (widgetId: string) => {
    widgetStates.value.delete(widgetId)
  }

  const activateWidget = (widgetId: string) => {
    const state = widgetStates.value.get(widgetId)
    if (state) state.active = true
  }

  const deactivateWidget = (widgetId: string) => {
    const state = widgetStates.value.get(widgetId)
    if (state) state.active = false
  }

  const clear = () => {
    widgetStates.value.clear()
  }

  return {
    widgetStates,
    activeWidgetStates,
    inactiveWidgetStates,
    registerWidget,
    unregisterWidget,
    activateWidget,
    deactivateWidget,
    clear
  }
})
