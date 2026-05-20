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
    // The V1→V2 migration spreads input options at the top level of the spec,
    // so a backend-declared `default` lands on `colorSpec.default`. The V2
    // schema also allows a nested `options.default`, so read both locations
    // to remain compatible with hand-authored V2 specs.
    const defaultValue = colorSpec.default ?? options?.default ?? '#000000'

    const widget = node.addWidget('color', name, defaultValue, () => {}, {
      serialize: true
    }) as IColorWidget

    return widget
  }
}
