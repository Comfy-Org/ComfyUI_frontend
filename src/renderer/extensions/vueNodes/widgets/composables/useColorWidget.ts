import type { LGraphNode } from '@comfyorg/litegraph/litegraph'
import type { IColorWidget } from '@comfyorg/graph-model/widgets'
import { isColorInputSpec } from '@comfyorg/graph-model/nodeDefSchemaV2'
import type {
  ColorInputSpec,
  InputSpec as InputSpecV2
} from '@comfyorg/graph-model/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'

export const useColorWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IColorWidget => {
    if (!isColorInputSpec(inputSpec)) {
      console.error('Invalid input spec for color widget')
    }

    const colorSpec = inputSpec as ColorInputSpec
    const { name } = colorSpec
    const defaultValue =
      colorSpec.default ?? colorSpec.options?.default ?? '#000000'

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
