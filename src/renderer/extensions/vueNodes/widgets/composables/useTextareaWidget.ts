import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ITextareaWidget } from '@/lib/litegraph/src/types/widgets'
import { isTextareaInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  InputSpec as InputSpecV2,
  TextareaInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useTextareaWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): ITextareaWidget => {
    if (!isTextareaInputSpec(inputSpec)) {
      console.error('Invalid input spec for textarea widget')
    }

    const textareaSpec = inputSpec as TextareaInputSpec
    const { name, options } = textareaSpec
    const defaultValue = textareaSpec.default ?? options?.default ?? ''
    const rows = textareaSpec.rows ?? options?.rows ?? 5
    const cols = textareaSpec.cols ?? options?.cols ?? 50

    const widgetOptions = { rows, cols }

    const widget = node.addWidget('textarea', name, defaultValue, () => {}, {
      serialize: true,
      ...widgetOptions
    }) as ITextareaWidget

    return widget
  }
}
