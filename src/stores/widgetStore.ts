import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  type ComboInputSpecV2,
  type InputSpec,
  isComboInputSpecV1
} from '@/schemas/nodeDefSchema'
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

  function getDefaultValue(inputData: InputSpec) {
    if (Array.isArray(inputData[0]))
      return getDefaultValue(transformComboInput(inputData))

    // @ts-expect-error InputSpec is not typed correctly
    const widgetType = getWidgetType(inputData[0], inputData[1]?.name)

    const [_, props] = inputData

    if (!props) return undefined
    if (props.default) return props.default

    // @ts-expect-error InputSpec is not typed correctly
    if (widgetType === 'COMBO' && props.options?.length) return props.options[0]
    if (props.remote) return 'Loading...'
    return undefined
  }

  const transformComboInput = (inputData: InputSpec): ComboInputSpecV2 => {
    // @ts-expect-error InputSpec is not typed correctly
    return isComboInputSpecV1(inputData)
      ? [
          'COMBO',
          {
            options: inputData[0],
            ...Object(inputData[1] || {})
          }
        ]
      : inputData
  }

  return {
    widgets,
    getWidgetType,
    inputIsWidget,
    registerCustomWidgets,
    getDefaultValue
  }
})
