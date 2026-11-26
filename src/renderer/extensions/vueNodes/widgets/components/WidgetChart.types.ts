import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'
import type { ChartInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'

export type ChartWidgetOptions = IWidgetOptions & {
  type?: ChartInputSpec['chartType']
}
