import type { CurveData } from '@/components/curve/types'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ICurveWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  CurveInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const DEFAULT_CURVE_DATA: CurveData = {
  points: [
    [0, 0],
    [1, 1]
  ],
  interpolation: 'monotone_cubic'
}

export const useCurveWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): ICurveWidget => {
    const spec = inputSpec as CurveInputSpec
    const defaultValue: CurveData = spec.default
      ? { ...spec.default, points: [...spec.default.points] }
      : { ...DEFAULT_CURVE_DATA, points: [...DEFAULT_CURVE_DATA.points] }

    const rawWidget = node.addWidget('curve', spec.name, defaultValue, () => {})

    if (rawWidget.type !== 'curve') {
      throw new Error(`Unexpected widget type: ${rawWidget.type}`)
    }

    return rawWidget as ICurveWidget
  }
}
