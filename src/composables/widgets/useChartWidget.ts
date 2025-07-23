import type { LGraphNode } from '@comfyorg/litegraph'
import type { IChartWidget } from '@comfyorg/litegraph/dist/types/widgets'

import type {
  ChartInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useChartWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IChartWidget => {
    const { name, options = {} } = inputSpec as ChartInputSpec

    const widget = node.addWidget('chart', name, options.data || {}, () => {}, {
      serialize: true,
      type: options.type || 'line',
      ...options
    }) as IChartWidget

    return widget
  }
}
