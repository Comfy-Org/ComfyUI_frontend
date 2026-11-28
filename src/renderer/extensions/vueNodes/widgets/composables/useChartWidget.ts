import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IChartWidget } from '@comfyorg/graph-model/widgets'
import { isChartInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'

export const useChartWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IChartWidget => {
    if (!isChartInputSpec(inputSpec)) {
      throw new Error('Invalid input spec for chart widget')
    }

    const { name, options } = inputSpec
    const chartType = inputSpec.chartType ?? options?.type ?? 'line'
    const data = inputSpec.data ?? options?.data ?? {}

    const widgetOptions = { serialize: true, type: chartType }

    const widget = node.addWidget(
      'chart',
      name,
      data,
      () => {},
      widgetOptions
    ) as IChartWidget

    return widget
  }
}
