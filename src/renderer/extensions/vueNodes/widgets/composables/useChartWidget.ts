import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IChartWidget } from '@/lib/litegraph/src/types/widgets'
import { isChartInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useChartWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IChartWidget => {
    if (!isChartInputSpec(inputSpec)) {
      throw new Error('Invalid input spec for chart widget')
    }

    const { name, chartType = 'line', data = {} } = inputSpec

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
