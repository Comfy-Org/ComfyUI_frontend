import { defineStore } from 'pinia'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { asGraphId, nodeEntityId, widgetEntityId } from '@/world/entityIds'
import { getWorld } from '@/world/worldInstance'

import type { WidgetValue } from './widgetComponents'
import {
  WidgetContainerComponent,
  WidgetValueComponent
} from './widgetComponents'

/**
 * Strips graph/subgraph prefixes from a scoped node ID to get the bare node ID.
 * e.g., "graph1:subgraph2:42" → "42"
 */
export function stripGraphPrefix(scopedId: NodeId | string): NodeId {
  return String(scopedId).replace(/^(.*:)+/, '') as NodeId
}

export interface WidgetState<
  TValue = unknown,
  TType extends string = string,
  TOptions extends IWidgetOptions = IWidgetOptions
> extends Pick<
  IBaseWidget<TValue, TType, TOptions>,
  'name' | 'type' | 'value' | 'options' | 'label' | 'serialize' | 'disabled'
> {
  nodeId: NodeId
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  function registerWidget<TValue = unknown>(
    graphId: UUID,
    state: WidgetState<TValue>
  ): WidgetState<TValue> {
    const world = getWorld()
    const branded = asGraphId(graphId)
    const widgetId = widgetEntityId(branded, state.nodeId, state.name)
    world.setComponent(widgetId, WidgetValueComponent, state as WidgetValue)

    const ownerId = nodeEntityId(branded, state.nodeId)
    const container = world.getComponent(ownerId, WidgetContainerComponent)
    if (!container) {
      world.setComponent(ownerId, WidgetContainerComponent, {
        widgetIds: [widgetId]
      })
    } else if (!container.widgetIds.includes(widgetId)) {
      container.widgetIds.push(widgetId)
    }

    return world.getComponent(
      widgetId,
      WidgetValueComponent
    ) as WidgetState<TValue>
  }

  function getWidget(
    graphId: UUID,
    nodeId: NodeId,
    widgetName: string
  ): WidgetState | undefined {
    const world = getWorld()
    const widgetId = widgetEntityId(asGraphId(graphId), nodeId, widgetName)
    return world.getComponent(widgetId, WidgetValueComponent) as
      | WidgetState
      | undefined
  }

  function getNodeWidgets(graphId: UUID, nodeId: NodeId): WidgetState[] {
    const world = getWorld()
    const ownerId = nodeEntityId(asGraphId(graphId), nodeId)
    const container = world.getComponent(ownerId, WidgetContainerComponent)
    if (!container) return []
    const widgets: WidgetState[] = []
    for (const widgetId of container.widgetIds) {
      const value = world.getComponent(widgetId, WidgetValueComponent)
      if (value) widgets.push(value as WidgetState)
    }
    return widgets
  }

  function clearGraph(graphId: UUID): void {
    const world = getWorld()
    // Branded IDs ARE strings at runtime; bare interpolation is intentional.
    const widgetPrefix = `widget:${graphId}:`
    const nodePrefix = `node:${graphId}:`
    for (const widgetId of world.entitiesWith(WidgetValueComponent)) {
      if ((widgetId as string).startsWith(widgetPrefix)) {
        world.removeComponent(widgetId, WidgetValueComponent)
      }
    }
    for (const nodeId of world.entitiesWith(WidgetContainerComponent)) {
      if ((nodeId as string).startsWith(nodePrefix)) {
        world.removeComponent(nodeId, WidgetContainerComponent)
      }
    }
  }

  return {
    registerWidget,
    getWidget,
    getNodeWidgets,
    clearGraph
  }
})
