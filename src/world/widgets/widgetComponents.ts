// Phase A stub — replaced by real ECS widget components when PR #11939 lands.
// Tests mock this module via vi.mock('@/world/widgets/widgetComponents').

import { defineComponentKey } from '../componentKey'
import type { NodeEntityId, WidgetEntityId } from '../entityIds'

interface WidgetContainerData {
  widgetIds: WidgetEntityId[]
}
interface WidgetDisplayData {
  label?: string
  hidden?: boolean
  disabled?: boolean
}
interface WidgetSchemaData {
  type?: string
  options?: Record<string, unknown>
}
interface WidgetSerializeData {
  serialize?: boolean
}
interface WidgetValueData {
  value?: unknown
}

export const WidgetComponentContainer = defineComponentKey<
  WidgetContainerData,
  NodeEntityId
>('WidgetComponentContainer')
export const WidgetComponentDisplay = defineComponentKey<
  WidgetDisplayData,
  WidgetEntityId
>('WidgetComponentDisplay')
export const WidgetComponentSchema = defineComponentKey<
  WidgetSchemaData,
  WidgetEntityId
>('WidgetComponentSchema')
export const WidgetComponentSerialize = defineComponentKey<
  WidgetSerializeData,
  WidgetEntityId
>('WidgetComponentSerialize')
export const WidgetComponentValue = defineComponentKey<
  WidgetValueData,
  WidgetEntityId
>('WidgetComponentValue')
