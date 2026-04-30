import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import { defineComponentKeys, slot } from '@/world/componentKey'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'

interface WidgetValue {
  value: unknown
}

interface WidgetDisplay {
  label?: string
  disabled?: boolean
}

interface WidgetSchema {
  type: string
  options: IWidgetOptions
}

interface WidgetSerialize {
  serialize?: boolean
}

interface WidgetContainer {
  widgetIds: WidgetEntityId[]
}

export const {
  WidgetComponentValue,
  WidgetComponentDisplay,
  WidgetComponentSchema,
  WidgetComponentSerialize,
  WidgetComponentContainer
} = defineComponentKeys('Widget', {
  Value: slot<WidgetValue, WidgetEntityId>(),
  Display: slot<WidgetDisplay, WidgetEntityId>(),
  Schema: slot<WidgetSchema, WidgetEntityId>(),
  Serialize: slot<WidgetSerialize, WidgetEntityId>(),
  Container: slot<WidgetContainer, NodeEntityId>()
})
