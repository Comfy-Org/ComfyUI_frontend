import type { LGraphNode } from '@comfyorg/litegraph/litegraph'
import { isBooleanInputSpec } from '@comfyorg/graph-model/nodeDefSchemaV2'
import type { InputSpec } from '@comfyorg/graph-model/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'

export const useBooleanWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isBooleanInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }

    const defaultVal = inputSpec.default ?? false
    const options = {
      on: inputSpec.label_on,
      off: inputSpec.label_off
    }

    return node.addWidget(
      'toggle',
      inputSpec.name,
      defaultVal,
      () => {},
      options
    )
  }

  return widgetConstructor
}
