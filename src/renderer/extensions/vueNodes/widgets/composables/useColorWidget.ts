import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IColorWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  ColorInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useColorWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IColorWidget => {
    const colorSpec = inputSpec as ColorInputSpec
    const { name, options } = colorSpec
    const defaultValue = colorSpec.default ?? options?.default ?? '#000000'

    const existing = node.widgets?.find(
      (w): w is IColorWidget => w.name === name && w.type === 'color'
    )
    if (existing) return existing

    const widget = node.addWidget('color', name, defaultValue, () => {}, {
      serialize: true
    }) as IColorWidget

    return widget
  }
}
