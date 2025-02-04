import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ComfyWidgetConstructor, ComfyWidgets } from '@/scripts/widgets'
import { ComboInputSpec, ComboInputSpecV2, InputSpec } from '@/types/apiTypes'

export const useWidgetStore = defineStore('widget', () => {
  const coreWidgets = ComfyWidgets
  const customWidgets = ref<Record<string, ComfyWidgetConstructor>>({})
  const widgets = computed(() => ({
    ...customWidgets.value,
    ...coreWidgets
  }))

  function getWidgetType(inputData: InputSpec) {
    const [type, { name }] = inputData
    if (type === 'COMBO' || Array.isArray(type)) {
      return 'COMBO'
    } else if (type === 'FILE_COMBO') {
      return 'FILE_COMBO'
    } else if (`${type}:${name}` in widgets.value) {
      return `${type}:${name}`
    } else if (type in widgets.value) {
      return type
    } else {
      return null
    }
  }

  function inputIsWidget(inputData: InputSpec) {
    return getWidgetType(inputData) !== null
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
    const widgetType = getWidgetType(inputData)
    if (widgetType === 'COMBO')
      return getDefaultValue(transformComboInput(inputData))

    const [_, props] = inputData

    if (props.default) return props.default

    if (widgetType === 'COMBO' && props.options?.length) return props.options[0]
    if (props.type === 'remote') return 'Loading...'
    return null
  }

  function transformComboInput(
    inputData: ComboInputSpec | ComboInputSpecV2
  ): ComboInputSpecV2 {
    if (isComboInputV2(inputData)) {
      return inputData
    }
    return [
      'COMBO',
      // creating new references
      {
        options: inputData[0],
        ...Object(inputData[1])
      }
    ]
  }

  function isComboInputV2(inputData: InputSpec): inputData is ComboInputSpecV2 {
    return inputData[0] === 'COMBO' && inputData[1]?.options
  }

  return {
    widgets,
    getWidgetType,
    inputIsWidget,
    registerCustomWidgets,
    getDefaultValue
  }
})
