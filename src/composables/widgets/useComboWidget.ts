import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import MultiSelectWidget from '@/components/graph/widgets/MultiSelectWidget.vue'
import {
  ComboInputSpec,
  type InputSpec,
  isComboInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  type BaseDOMWidget,
  ComponentWidgetImpl,
  addWidget
} from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgetTypes'

import { useDropdownComboWidget } from './useDropdownComboWidget'

// Default value logic is now handled in useDropdownComboWidget

const addMultiSelectWidget = (node: LGraphNode, inputSpec: ComboInputSpec) => {
  const widgetValue = ref<string[]>([])
  const widget = new ComponentWidgetImpl({
    node,
    name: inputSpec.name,
    component: MultiSelectWidget,
    inputSpec,
    options: {
      getValue: () => widgetValue.value,
      setValue: (value: string[]) => {
        widgetValue.value = value
      }
    }
  })
  addWidget(node, widget as BaseDOMWidget<object | string>)
  // TODO: Add remote support to multi-select widget
  // https://github.com/Comfy-Org/ComfyUI_frontend/issues/3003
  return widget
}

const addComboWidget = (node: LGraphNode, inputSpec: ComboInputSpec) => {
  // Use the new dropdown combo widget for single-selection combo widgets
  const dropdownWidget = useDropdownComboWidget()
  return dropdownWidget(node, inputSpec)
}

export const useComboWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isComboInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }
    return inputSpec.multi_select
      ? addMultiSelectWidget(node, inputSpec)
      : addComboWidget(node, inputSpec)
  }

  return widgetConstructor
}
