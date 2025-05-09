import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import PreviewtextWidget from '@/components/graph/widgets/PreviewtextWidget.vue'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const PADDING = 16

export const useProgressTextWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    const initialNodeWidth = node.width
    const widgetValue = ref<string>('')
    const widget = new ComponentWidgetImpl<string | object>({
      node,
      name: inputSpec.name,
      component: PreviewtextWidget,
      inputSpec,
      options: {
        getValue: () => widgetValue.value,
        setValue: (value: string | object) => {
          widgetValue.value = typeof value === 'string' ? value : String(value)
        }
      }
    })
    widget.computeLayoutSize = () => {
      return {
        minWidth: initialNodeWidth,
        minHeight: 28 + PADDING,
        maxHeight: 142 + PADDING
      }
    }
    addWidget(node, widget)
    return widget
  }

  return widgetConstructor
}
