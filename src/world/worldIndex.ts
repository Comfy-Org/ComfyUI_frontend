import { WidgetContainerComponent } from './components/WidgetContainer'
import type { NodeEntityId, WidgetEntityId } from './entityIds'
import type { World } from './world'

/**
 * Read-side helpers that compute reverse lookups from canonical components.
 * Slice 1 implements `widgetParent` only. Optimisations (denormalised
 * caches) are deferred until profiling demands them.
 */
export const worldIndex = {
  widgetParent(
    world: World,
    widgetId: WidgetEntityId
  ): NodeEntityId | undefined {
    for (const nodeId of world.entitiesWith(WidgetContainerComponent)) {
      const container = world.getComponent(nodeId, WidgetContainerComponent)
      if (container?.widgetIds.includes(widgetId)) return nodeId
    }
    return undefined
  }
}
