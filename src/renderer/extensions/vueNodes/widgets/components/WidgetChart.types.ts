import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'
import type { ChartInputSpec } from '@comfyorg/graph-model/nodeDefSchemaV2'

export type ChartWidgetOptions = IWidgetOptions & {
  type?: ChartInputSpec['chartType']
}
