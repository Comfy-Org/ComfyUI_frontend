import { defineAsyncComponent } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isStringInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const WidgetTextarea = defineAsyncComponent(
  () => import('../components/WidgetTextarea.vue')
)

function addMultilineWidget(
  node: LGraphNode,
  inputSpec: InputSpec,
  opts: { defaultVal: string; placeholder?: string }
) {
  const widget = new ComponentWidgetImpl<string>({
    node,
    name: inputSpec.name,
    component: WidgetTextarea,
    inputSpec,
    type: 'customtext',
    props: { placeholder: opts.placeholder ?? inputSpec.name },
    options: { minNodeSize: [400, 200] },
    value: opts.defaultVal
  })

  addWidget(node, widget)
  return widget
}

export const useStringWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isStringInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }

    const defaultVal = inputSpec.default ?? ''
    const multiline = inputSpec.multiline

    const widget = multiline
      ? addMultilineWidget(node, inputSpec, {
          defaultVal,
          placeholder: inputSpec.placeholder
        })
      : node.addWidget('text', inputSpec.name, defaultVal, () => {}, {})

    if (typeof inputSpec.dynamicPrompts === 'boolean') {
      widget.dynamicPrompts = inputSpec.dynamicPrompts
    }

    return widget
  }

  return widgetConstructor
}
