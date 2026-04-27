import { defineComponentKey } from '../componentKey'
import type { WidgetEntityId } from '../entityIds'

/**
 * Static identity for a widget entity. Intentionally has NO `parentNodeId`
 * back-reference — reverse lookup goes via the node-side `WidgetContainer`
 * component plus `WorldIndex.widgetParent()`. See ADR 0008.
 */
export interface WidgetIdentity {
  name: string
  widgetType: string
}

export const WidgetIdentityComponent = defineComponentKey<
  WidgetIdentity,
  WidgetEntityId
>('WidgetIdentity')
