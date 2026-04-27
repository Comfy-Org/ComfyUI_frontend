import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { WidgetValue } from '@/stores/widgetComponents'
import {
  WidgetContainerComponent,
  WidgetValueComponent
} from '@/stores/widgetComponents'
import type { WidgetState } from '@/stores/widgetValueStore'

import type { GraphId } from './entityIds'
import { nodeEntityId, widgetEntityId } from './entityIds'
import type { World } from './world'

/**
 * Slice 1 bridge: writes widget entities into the World whenever
 * `WidgetValueStore.registerWidget` runs. The `state` argument is the
 * SAME reactive object the store holds — sharing identity preserves Vue
 * tracking across both read paths.
 */
export function registerWidgetInWorld(
  world: World,
  graphId: GraphId,
  state: WidgetState
): void {
  const widgetId = widgetEntityId(graphId, state.nodeId, state.name)
  // `state` IS the reactive object owned by `WidgetValueStore`; sharing the
  // reference is intentional — Vue tracking flows through both read paths
  // during the slice-1 bridge window. The wider WidgetState shape collapses
  // to `WidgetValue` at the component-key boundary.
  world.setComponent(widgetId, WidgetValueComponent, state as WidgetValue)

  const nodeId = nodeEntityId(graphId, state.nodeId)
  const container = world.getComponent(nodeId, WidgetContainerComponent)
  if (!container) {
    world.setComponent(nodeId, WidgetContainerComponent, {
      widgetIds: [widgetId]
    })
    return
  }
  if (!container.widgetIds.includes(widgetId)) {
    container.widgetIds.push(widgetId)
  }
}

/**
 * Look up all widget value states attached to a node, going through the
 * World rather than the Pinia store. Used by `useUpstreamValue`.
 */
export function getNodeWidgetsThroughWorld(
  world: World,
  graphId: GraphId,
  nodeId: NodeId
): WidgetState[] {
  const owner = nodeEntityId(graphId, nodeId)
  const container = world.getComponent(owner, WidgetContainerComponent)
  if (!container) return []
  const widgets: WidgetState[] = []
  for (const widgetId of container.widgetIds) {
    const value = world.getComponent(widgetId, WidgetValueComponent)
    if (value) widgets.push(value as unknown as WidgetState)
  }
  return widgets
}
