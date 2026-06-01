import { defineComponentKey } from '@/world/componentKey'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'

import type { WidgetState } from './widgetState'

interface WidgetContainer {
  widgetIds: WidgetEntityId[]
}

export const WidgetComponent = defineComponentKey<WidgetState, WidgetEntityId>(
  'WidgetComponent'
)

export const WidgetComponentContainer = defineComponentKey<
  WidgetContainer,
  NodeEntityId
>('WidgetComponentContainer')
