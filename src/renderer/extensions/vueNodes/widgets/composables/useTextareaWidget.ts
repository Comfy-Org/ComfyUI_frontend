import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ITextareaWidget } from '@/lib/litegraph/src/types/widgets'
import { isTextareaInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useTextareaWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): ITextareaWidget => {
    if (!isTextareaInputSpec(inputSpec)) {
      throw new Error('Invalid input spec for textarea widget')
    }

    const { name, default: defaultValue = '', rows = 5, cols = 50 } = inputSpec

    const widgetOptions = { rows, cols }

    const widget = node.addWidget('textarea', name, defaultValue, () => {}, {
      serialize: true,
      ...widgetOptions
    }) as ITextareaWidget

    return widget
  }
}
