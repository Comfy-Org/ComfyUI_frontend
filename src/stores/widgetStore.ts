import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComfyWidgetConstructor, ComfyWidgets } from '@/scripts/widgets'

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
      /**
       * @deprecated Group node logic. Remove once group node feature is removed.
       */
    } else if (`${type}:${inputName}` in widgets.value) {
      return `${type}:${inputName}`
    } else if (type in widgets.value) {
      return type
    } else {
      return null
    }
  }

  function inputIsWidget(spec: InputSpecV2) {
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
