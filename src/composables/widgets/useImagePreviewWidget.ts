import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import ImagePreviewWidget from '@/components/graph/widgets/ImagePreviewWidget.vue'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { type ComfyWidgetConstructorV2 } from '@/scripts/widgetTypes'

const PADDING = 8

export const useImagePreviewWidget = (
  options: { defaultValue?: string | string[] } = {}
) => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    // Initialize widget value
    const widgetValue = ref<string | string[]>(
      options.defaultValue ?? (inputSpec.allow_batch ? [] : '')
    )

    // Create the Vue-based widget instance
    const widget = new ComponentWidgetImpl<string | string[]>({
      node,
      name: inputSpec.name,
      component: ImagePreviewWidget,
      inputSpec,
      options: {
        // Required: getter for widget value
        getValue: () => widgetValue.value,

        // Required: setter for widget value
        setValue: (value: string | string[]) => {
          widgetValue.value = value
        },

        // Optional: minimum height for the widget
        getMinHeight: () => 320 + PADDING,
        getMaxHeight: () => 512 + PADDING,

        // Optional: whether to serialize this widget's value
        serialize: false
      }
    })

    // Register the widget with the node
    addWidget(node, widget as any)

    return widget
  }

  return widgetConstructor
}
