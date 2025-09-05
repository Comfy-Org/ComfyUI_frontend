import { ref } from 'vue'

import ChatHistoryWidget from '@/components/graph/widgets/ChatHistoryWidget.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  ComponentWidgetImpl,
  type ComponentWidgetStandardProps,
  addWidget
} from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

type ChatHistoryCustomProps = Omit<
  InstanceType<typeof ChatHistoryWidget>['$props'],
  ComponentWidgetStandardProps
>

const PADDING = 16

export const useChatHistoryWidget = (
  options: {
    props?: ChatHistoryCustomProps
  } = {}
) => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    const widgetValue = ref<string>('')
    const widget = new ComponentWidgetImpl<
      string | object,
      ChatHistoryCustomProps
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
