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

  function inputIsWidget(spec: InputSpecV2) {
    return spec.type in widgets.value
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
    inputIsWidget,
    registerCustomWidgets
  }
})
