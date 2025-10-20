import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IMultiSelectWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  InputSpec as InputSpecV2,
  MultiSelectInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useMultiSelectWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IMultiSelectWidget => {
    const { name, options = {} } = inputSpec as MultiSelectInputSpec

    const widget = node.addWidget('multiselect', name, [], () => {}, {
      serialize: true,
      values: options.values || [],
      ...options
    }) as IMultiSelectWidget

    return widget
  }
}
