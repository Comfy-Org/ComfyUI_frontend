import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import TextPreviewWidget from '@/components/graph/widgets/TextPreviewWidget.vue'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const PADDING = 16

export const useTextPreviewWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    const widgetValue = ref<string>('')
    const widget = new ComponentWidgetImpl<string | object>({
      node,
      name: inputSpec.name,
      component: TextPreviewWidget,
      inputSpec,
      options: {
        getValue: () => widgetValue.value,
        setValue: (value: string | object) => {
          widgetValue.value = typeof value === 'string' ? value : String(value)
        },
        getMinHeight: () => 42 + PADDING
      }
    })
    addWidget(node, widget)
    return widget
  }

  return widgetConstructor
}
