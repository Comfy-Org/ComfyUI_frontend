import { defineStore } from 'pinia'

import type { UUID } from '@/utils/uuid'
import {
  asGraphId,
  isNodeIdForGraph,
  isWidgetIdForGraph,
  nodeEntityId,
  parseWidgetEntityId
} from '@/world/entityIds'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'
import {
  WidgetComponent,
  WidgetComponentContainer
} from '@/world/widgets/widgetComponents'
import type { WidgetState } from '@/world/widgets/widgetState'
import { getWorld } from '@/world/worldInstance'

export type { WidgetState } from '@/world/widgets/widgetState'

export const useWidgetValueStore = defineStore('widgetValue', () => {
  function registerWidget<TValue = unknown>(
    widgetId: WidgetEntityId,
    state: WidgetState<TValue>
  ): WidgetState<TValue> {
    const world = getWorld()
    const { graphId, nodeId } = parseWidgetEntityId(widgetId)

    world.setComponent(widgetId, WidgetComponent, {
      ...state,
      disabled: state.disabled ?? false
    })

    const ownerId = nodeEntityId(graphId, nodeId)
    const container = world.getComponent(ownerId, WidgetComponentContainer)
    if (!container) {
      world.setComponent(ownerId, WidgetComponentContainer, {
        widgetIds: [widgetId]
      })
    } else if (!container.widgetIds.includes(widgetId)) {
      container.widgetIds.push(widgetId)
    }

    return world.getComponent(widgetId, WidgetComponent) as WidgetState<TValue>
  }

  function getWidget(widgetId: WidgetEntityId): WidgetState | undefined {
    return getWorld().getComponent(widgetId, WidgetComponent)
  }

  function getNodeWidgets(nodeId: NodeEntityId): WidgetState[] {
    const world = getWorld()
    const container = world.getComponent(nodeId, WidgetComponentContainer)
    if (!container) return []
    const widgets: WidgetState[] = []
    for (const widgetId of container.widgetIds) {
      const w = world.getComponent(widgetId, WidgetComponent)
      if (w) widgets.push(w)
    }
    return widgets
  }

  function getNodeWidgetsByName(
    nodeId: NodeEntityId
  ): Map<string, WidgetState> {
    const world = getWorld()
    const container = world.getComponent(nodeId, WidgetComponentContainer)
    const result = new Map<string, WidgetState>()
    if (!container) return result
    for (const widgetId of container.widgetIds) {
      const w = world.getComponent(widgetId, WidgetComponent)
      if (!w) continue
      const { name } = parseWidgetEntityId(widgetId)
      result.set(name, w)
    }
    return result
  }

  function setValue(
    widgetId: WidgetEntityId,
    value: WidgetState['value']
  ): boolean {
    const bucket = getWorld().getComponent(widgetId, WidgetComponent)
    if (!bucket) return false
    bucket.value = value
    return true
  }

  function clearGraph(graphId: UUID): void {
    const world = getWorld()
    const branded = asGraphId(graphId)
    for (const widgetId of world.entitiesWith(WidgetComponent)) {
      if (isWidgetIdForGraph(branded, widgetId)) {
        world.removeComponent(widgetId, WidgetComponent)
      }
    }
    for (const nodeId of world.entitiesWith(WidgetComponentContainer)) {
      if (isNodeIdForGraph(branded, nodeId)) {
        world.removeComponent(nodeId, WidgetComponentContainer)
      }
    }
  }

  return {
    registerWidget,
    getWidget,
    setValue,
    getNodeWidgets,
    getNodeWidgetsByName,
    clearGraph
  }
})
