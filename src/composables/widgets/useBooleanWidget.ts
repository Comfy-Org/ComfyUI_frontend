import type { LGraphNode } from '@comfyorg/litegraph'

import type { InputSpec } from '@/schemas/nodeDefSchema'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'

export const useBooleanWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec
  ) => {
    const inputOptions = inputData[1]
    const defaultVal = inputOptions?.default ?? false
    const options = {
      on: inputOptions?.label_on,
      off: inputOptions?.label_off
    }

    return {
      // @ts-expect-error InputSpec is not typed correctly
      widget: node.addWidget('toggle', inputName, defaultVal, () => {}, options)
    }
  }

  return widgetConstructor
}
