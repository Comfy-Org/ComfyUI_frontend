import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import ChatHistoryWidget from '@/components/graph/widgets/ChatHistoryWidget.vue'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const PADDING = 16

export const useChatHistoryWidget = (
  options: {
    props?: Omit<InstanceType<typeof ChatHistoryWidget>['$props'], 'widget'>
  } = {}
) => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    const widgetValue = ref<string>('')
    const widget = new ComponentWidgetImpl<
      string | object,
      InstanceType<typeof ChatHistoryWidget>['$props']
    >({
      node,
      name: inputSpec.name,
      component: ChatHistoryWidget,
      props: options.props,
      inputSpec,
      options: {
        getValue: () => widgetValue.value,
        setValue: (value: string | object) => {
          widgetValue.value = typeof value === 'string' ? value : String(value)
        },
        getMinHeight: () => 400 + PADDING
      }
    })
    addWidget(node, widget)
    return widget
  }

  return widgetConstructor
}
