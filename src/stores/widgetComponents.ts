import { defineComponentKey } from '@/world/componentKey'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'

/**
 * Per-widget value. The bridge to `useWidgetValueStore` shares the same
 * reactive object reference so Vue tracking is preserved across both
 * read paths. The wider WidgetState shape collapses to `WidgetValue` at
 * the component-key boundary.
 */
export interface WidgetValue {
  value: unknown
}

export const WidgetValueComponent = defineComponentKey<
  WidgetValue,
  WidgetEntityId
>('WidgetValue')

/**
 * Node-side list of widget entity ids. Forward lookup
 * (`node → widgets`) goes through `getNodeWidgets()` on the store.
 */
interface WidgetContainer {
  widgetIds: WidgetEntityId[]
}

export const WidgetContainerComponent = defineComponentKey<
  WidgetContainer,
  NodeEntityId
>('WidgetContainer')
