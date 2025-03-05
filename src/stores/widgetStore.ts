import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  type InputSpec as InputSpecV1,
  getInputSpecType
} from '@/schemas/nodeDefSchema'
import { ComfyWidgetConstructor, ComfyWidgets } from '@/scripts/widgets'

export const useWidgetStore = defineStore('widget', () => {
  const coreWidgets = ComfyWidgets
  const customWidgets = ref<Record<string, ComfyWidgetConstructor>>({})
  const widgets = computed(() => ({
    ...customWidgets.value,
    ...coreWidgets
  }))

  function inputIsWidget(spec: InputSpecV2 | InputSpecV1) {
    const type = Array.isArray(spec) ? getInputSpecType(spec) : spec.type
    return type in widgets.value
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
