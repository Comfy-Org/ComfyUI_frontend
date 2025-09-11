import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ITreeSelectWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  InputSpec as InputSpecV2,
  TreeSelectInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useTreeSelectWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): ITreeSelectWidget => {
    const { name, options = {} } = inputSpec as TreeSelectInputSpec
    const isMultiple = options.multiple || false
    const defaultValue = isMultiple ? [] : ''

    const widget = node.addWidget('treeselect', name, defaultValue, () => {}, {
      serialize: true,
      values: options.values || [],
      multiple: isMultiple,
      ...options
    }) as ITreeSelectWidget

    return widget
  }
}
