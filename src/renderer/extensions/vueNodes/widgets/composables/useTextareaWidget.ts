import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ITextareaWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  InputSpec as InputSpecV2,
  TextareaInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useTextareaWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): ITextareaWidget => {
    const textareaSpec = inputSpec as TextareaInputSpec
    const { name, default: defaultValue = '' } = textareaSpec
    const widgetOptions = {
      rows: textareaSpec.rows ?? 5,
      cols: textareaSpec.cols ?? 50
    }

    const widget = node.addWidget('textarea', name, defaultValue, () => {}, {
      serialize: true,
      ...widgetOptions
    }) as ITextareaWidget

    return widget
  }
}
