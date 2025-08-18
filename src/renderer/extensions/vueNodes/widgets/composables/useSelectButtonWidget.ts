import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISelectButtonWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  InputSpec as InputSpecV2,
  SelectButtonInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useSelectButtonWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): ISelectButtonWidget => {
    const { name, options = {} } = inputSpec as SelectButtonInputSpec
    const values = options.values || []

    const widget = node.addWidget(
      'selectbutton',
      name,
      values[0] || '',
      (_value: string) => {},
      {
        serialize: true,
        values,
        ...options
      }
    ) as ISelectButtonWidget

    return widget
  }
}
