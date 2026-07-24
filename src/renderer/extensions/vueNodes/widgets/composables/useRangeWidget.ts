import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IRangeWidget,
  IWidgetRangeOptions
} from '@/lib/litegraph/src/types/widgets'
import type { RangeInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useRangeWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec): IRangeWidget => {
    const spec = inputSpec as RangeInputSpec
    const defaultValue = spec.default ?? { min: 0.0, max: 1.0 }

    const options: IWidgetRangeOptions = {
      display: spec.display,
      gradient_stops: spec.gradient_stops,
      show_midpoint: spec.show_midpoint,
      midpoint_scale: spec.midpoint_scale,
      value_min: spec.value_min,
      value_max: spec.value_max
    }

    const rawWidget = node.addWidget(
      'range',
      spec.name,
      { ...defaultValue },
      () => {},
      options
    )

    if (rawWidget.type !== 'range') {
      throw new Error(`Unexpected widget type: ${rawWidget.type}`)
    }

    return rawWidget as IRangeWidget
  }
}
