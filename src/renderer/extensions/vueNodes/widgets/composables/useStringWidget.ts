import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isStringInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

import WidgetTextarea from '../components/WidgetTextarea.vue'

function addMultilineWidget(
  node: LGraphNode,
  name: string,
  inputSpec: InputSpec,
  opts: { defaultVal: string; placeholder?: string }
) {
  const widget = new ComponentWidgetImpl({
    node,
    name,
    component: WidgetTextarea,
    inputSpec,
    type: 'customtext',
    props: { placeholder: opts.placeholder || name },
    options: {
      minNodeSize: [400, 200]
    }
  })

  addWidget(node, widget as BaseDOMWidget<object | string>)
  widget.value = opts.defaultVal

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
      ? addMultilineWidget(node, inputSpec.name, inputSpec, {
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
