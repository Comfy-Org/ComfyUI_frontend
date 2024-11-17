import { ComfyWidgets, ComfyWidgetConstructor } from '@/scripts/widgets'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BaseInputSpec } from './nodeDefStore'

export const useWidgetStore = defineStore('widget', () => {
  const coreWidgets = ComfyWidgets
  const customWidgets = ref<Record<string, ComfyWidgetConstructor>>({})
  const widgets = computed(() => ({
    ...customWidgets.value,
    ...coreWidgets
  }))

  function getWidgetType(type: string, inputName: string) {
    if (type === 'COMBO') {
      return 'COMBO'
    } else if (`${type}:${inputName}` in widgets.value) {
      return `${type}:${inputName}`
    } else if (type in widgets.value) {
      return type
    } else {
      return null
    }
  }

  function inputIsWidget(spec: BaseInputSpec) {
    return getWidgetType(spec.type, spec.name) !== null
  }

  function registerCustomWidgets(
    newWidgets: Record<string, ComfyWidgetConstructor>
  ) {
    customWidgets.value = {
      ...customWidgets.value,
      ...newWidgets
    }
  }

  return {
    widgets,
    getWidgetType,
    inputIsWidget,
    registerCustomWidgets
  }
})
