import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { ChartInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

export type ChartWidgetOptions = IWidgetOptions & {
  type?: ChartInputSpec['chartType']
}
