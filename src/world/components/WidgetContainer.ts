import { defineComponentKey } from '../componentKey'
import type { NodeEntityId, WidgetEntityId } from '../entityIds'

/**
 * Node-side list of widget entity ids. Replaces a back-reference from
 * `WidgetIdentity` to its parent node. Reverse lookup
 * (`widget → node`) goes through `WorldIndex.widgetParent()`.
 */
export interface WidgetContainer {
  widgetIds: WidgetEntityId[]
}

export const WidgetContainerComponent = defineComponentKey<
  WidgetContainer,
  NodeEntityId
>('WidgetContainer')
