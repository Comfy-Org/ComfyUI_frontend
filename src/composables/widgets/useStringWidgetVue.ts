import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import StringWidget from '@/components/graph/widgets/StringWidget.vue'
import {
  type InputSpec,
  isStringInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { type ComfyWidgetConstructorV2 } from '@/scripts/widgetTypes'

const PADDING = 8

export const useStringWidgetVue = (options: { defaultValue?: string } = {}) => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isStringInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }

    // Initialize widget value
    const widgetValue = ref<string>(
      inputSpec.default ?? options.defaultValue ?? ''
    )

    // Create the Vue-based widget instance
    const widget = new ComponentWidgetImpl<string>({
      node,
      name: inputSpec.name,
      component: StringWidget,
      inputSpec,
      options: {
        // Required: getter for widget value
        getValue: () => widgetValue.value,

        // Required: setter for widget value
        setValue: (value: string) => {
          widgetValue.value = value
        },

        // Optional: minimum height for the widget
        getMinHeight: () => {
          return inputSpec.multiline ? 80 + PADDING : 40 + PADDING
        },

        // Optional: whether to serialize this widget's value
        serialize: true
      }
    })

    // Add dynamic prompts support if specified
    if (typeof inputSpec.dynamicPrompts === 'boolean') {
      widget.dynamicPrompts = inputSpec.dynamicPrompts
    }

    // Register the widget with the node
    addWidget(node, widget as any)

    return widget
  }

  return widgetConstructor
}
