import { defineComponentKey } from '@/world/componentKey'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'
import type { World } from '@/world/world'

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
 * Node-side list of widget entity ids. Reverse lookup
 * (`widget → node`) goes through `widgetParent()`.
 */
interface WidgetContainer {
  widgetIds: WidgetEntityId[]
}

export const WidgetContainerComponent = defineComponentKey<
  WidgetContainer,
  NodeEntityId
>('WidgetContainer')

/**
 * Reverse-lookup: which node owns this widget?
 * Walks `WidgetContainer` components; O(nodes) — denormalised cache
 * deferred until profiling demands it.
 */
export function widgetParent(
  world: World,
  widgetId: WidgetEntityId
): NodeEntityId | undefined {
  for (const nodeId of world.entitiesWith(WidgetContainerComponent)) {
    const container = world.getComponent(nodeId, WidgetContainerComponent)
    if (container?.widgetIds.includes(widgetId)) return nodeId
  }
  return undefined
}
