import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  ColorsInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useColorsWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IBaseWidget => {
    const spec = inputSpec as ColorsInputSpec
    const defaultValue: string[] = spec.default ? [...spec.default] : []
    return node.addWidget('colors', spec.name, defaultValue, null, {
      serialize: true,
      canvasOnly: false
    }) as IBaseWidget
  }
}
