import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { getInputSpecType } from '@/schemas/nodeDefSchema'
import type { InputSpec as InputSpecV1 } from '@/schemas/nodeDefSchema'
import type {
  ComfyWidgetConstructor,
  CustomComfyWidgetConstructor
} from '@/scripts/widgets'
import { ComfyWidgets } from '@/scripts/widgets'

type WidgetConstructor = ComfyWidgetConstructor | CustomComfyWidgetConstructor

export const useWidgetStore = defineStore('widget', () => {
  const coreWidgets = ComfyWidgets
  const customWidgets = ref<Map<string, CustomComfyWidgetConstructor>>(
    new Map()
  )
  const widgets = computed<Map<string, WidgetConstructor>>(
    () => new Map([...customWidgets.value, ...Object.entries(coreWidgets)])
  )

  function inputIsWidget(spec: InputSpecV2 | InputSpecV1) {
    const type = Array.isArray(spec) ? getInputSpecType(spec) : spec.type
    return widgets.value.has(type)
  }

  function registerCustomWidgets(
    newWidgets: Record<string, CustomComfyWidgetConstructor> | null | undefined
  ) {
    // Extensions are untrusted code: `getCustomWidgets` is typed to return
    // `Record<string, ...>`, but in practice an extension can resolve it to
    // null/undefined. Guard here so a single misbehaving custom node can't
    // throw "Cannot convert undefined or null to object" and break app init.
    if (!newWidgets) return
    for (const [type, widget] of Object.entries(newWidgets)) {
      customWidgets.value.set(type, widget)
    }
  }

  return {
    coreWidgets,
    widgets,
    inputIsWidget,
    registerCustomWidgets
  }
})
