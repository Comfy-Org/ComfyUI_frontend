import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import PreviewTextWidget from '@/components/graph/widgets/PreviewTextWidget.vue'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const PADDING = 16

export const useProgressTextWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    const widgetValue = ref<string>('')
    const widget = new ComponentWidgetImpl<string | object>({
      node,
      name: inputSpec.name,
      component: PreviewTextWidget,
      inputSpec,
      options: {
        getValue: () => widgetValue.value,
        setValue: (value: string | object) => {
          widgetValue.value = typeof value === 'string' ? value : String(value)
        },
        getMinHeight: () => 48 + PADDING
      }
    })
    addWidget(node, widget)
    return widget
  }

  return widgetConstructor
}
