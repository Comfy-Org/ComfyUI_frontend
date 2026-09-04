import { defineAsyncComponent } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const WidgetMarkdown = defineAsyncComponent(
  () => import('../components/WidgetMarkdown.vue')
)

function addMarkdownWidget(node: LGraphNode, inputSpec: InputSpec) {
  const widget = new ComponentWidgetImpl<string>({
    node,
    name: inputSpec.name,
    component: WidgetMarkdown,
    inputSpec,
    type: 'MARKDOWN',
    options: { minNodeSize: [400, 200] },
    value: inputSpec.default ?? ''
  })

  addWidget(node, widget)
  return widget
}

export const useMarkdownWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    return addMarkdownWidget(node, inputSpec)
  }

  return widgetConstructor
}
