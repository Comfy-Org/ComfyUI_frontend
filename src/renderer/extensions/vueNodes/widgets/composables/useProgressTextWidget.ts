import { ref } from 'vue'

import TextPreviewWidget from '@/components/graph/widgets/TextPreviewWidget.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  ComponentWidgetImpl,
  type ComponentWidgetStandardProps,
  addWidget
} from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

type TextPreviewCustomProps = Omit<
  InstanceType<typeof TextPreviewWidget>['$props'],
  ComponentWidgetStandardProps
>

const PADDING = 16

export const useTextPreviewWidget = (
  options: {
    minHeight?: number
  } = {}
) => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    const widgetValue = ref<string>('')
    const widget = new ComponentWidgetImpl<
      string | object,
      TextPreviewCustomProps
    >({
      node,
      name: inputSpec.name,
      component: TextPreviewWidget,
      inputSpec,
      props: {
        nodeId: node.id
      },
      options: {
        getValue: () => widgetValue.value,
        setValue: (value: string | object) => {
          widgetValue.value = typeof value === 'string' ? value : String(value)
        },
        getMinHeight: () => options.minHeight ?? 42 + PADDING,
        serialize: false
      }
    })
    addWidget(node, widget)
    return widget
  }

  return widgetConstructor
}
