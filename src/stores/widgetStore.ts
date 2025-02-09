import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ComfyWidgetConstructor, ComfyWidgets } from '@/scripts/widgets'
import {
  ComboInputSpecV2,
  InputSpec,
  isComboInputSpecV1
} from '@/types/apiTypes'

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

  function getDefaultValue(inputData: InputSpec) {
    if (Array.isArray(inputData[0]))
      return getDefaultValue(transformComboInput(inputData))

    const widgetType = getWidgetType(inputData[0], inputData[1].name)

    const [_, props] = inputData
    if (props.default) return props.default

    if (widgetType === 'COMBO' && props.options?.length) return props.options[0]
    if (props.remote) return 'Loading...'
    return undefined
  }

  const transformComboInput = (inputData: InputSpec): ComboInputSpecV2 => {
    return isComboInputSpecV1(inputData)
      ? [
          'COMBO',
          {
            options: inputData[0],
            ...Object(inputData[1])
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
