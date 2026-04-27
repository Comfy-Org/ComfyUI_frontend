import { defineComponentKey } from '../componentKey'
import type { WidgetEntityId } from '../entityIds'

/**
 * Per-widget value. The bridge to `WidgetValueStore` shares the same
 * reactive object reference so Vue tracking is preserved across both
 * read paths during the migration window.
 */
export interface WidgetValue<T = unknown> {
  value: T
}

export const WidgetValueComponent = defineComponentKey<
  WidgetValue,
  WidgetEntityId
>('WidgetValue')
