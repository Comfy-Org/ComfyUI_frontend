import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import MediaLoaderWidget from '@/components/graph/widgets/MediaLoaderWidget.vue'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  ComponentWidgetImpl,
  type DOMWidgetOptions,
  addWidget
} from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgetTypes'


interface MediaLoaderOptions {
  defaultValue?: string[]
  accept?: string
  onFilesSelected?: (files: File[]) => void
}

interface MediaLoaderWidgetOptions extends DOMWidgetOptions<string[]> {
  onFilesSelected?: (files: File[]) => void
}

export const useMediaLoaderWidget = (options: MediaLoaderOptions = {}) => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    // Initialize widget value
    const widgetValue = ref<string[]>(options.defaultValue ?? [])

    // Create the widget instance
    const widget = new ComponentWidgetImpl<string[], { accept?: string }>({
      node,
      name: inputSpec.name,
      component: MediaLoaderWidget,
      inputSpec,
      props: {
        accept: options.accept
      },
      options: {
        // Required: getter for widget value
        getValue: () => widgetValue.value,

        // Required: setter for widget value
        setValue: (value: string[]) => {
          widgetValue.value = Array.isArray(value) ? value : []
        },


        // Optional: whether to serialize this widget's value
        serialize: true,

        // Custom option for file selection callback
        onFilesSelected: options.onFilesSelected
      } as MediaLoaderWidgetOptions
    })

    // Register the widget with the node
    addWidget(node, widget as any)

    return widget
  }

  return widgetConstructor
}
