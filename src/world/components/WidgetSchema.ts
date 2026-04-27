import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'

import { defineComponentKey } from '../componentKey'
import type { WidgetEntityId } from '../entityIds'

export interface WidgetSchema {
  options: IWidgetOptions
  serialize?: boolean
}

export const WidgetSchemaComponent = defineComponentKey<
  WidgetSchema,
  WidgetEntityId
>('WidgetSchema')
