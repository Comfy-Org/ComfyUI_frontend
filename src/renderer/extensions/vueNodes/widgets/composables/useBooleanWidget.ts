import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isBooleanInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export function useBooleanWidget() {
  function widgetConstructor(node: LGraphNode, inputSpec: InputSpec) {
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

  return widgetConstructor satisfies ComfyWidgetConstructorV2
}
