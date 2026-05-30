import { defineStore } from 'pinia'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/utils/uuid'
import type { ComponentKey } from '@/world/componentKey'
import {
  asGraphId,
  isNodeIdForGraph,
  isWidgetIdForGraph,
  nodeEntityId,
  parseWidgetEntityId
} from '@/world/entityIds'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'
import {
  WidgetComponentContainer,
  WidgetComponentDisplay,
  WidgetComponentSchema,
  WidgetComponentSerialize,
  WidgetComponentValue
} from '@/world/widgets/widgetComponents'
import type { WidgetState } from '@/world/widgets/widgetState'
import { getWorld } from '@/world/worldInstance'

export type { WidgetState } from '@/world/widgets/widgetState'

/**
 * Strips graph-scope prefix segments from a node id, returning the
 * trailing raw node id. Used by `useProcessedWidgets` to derive stable
 * DOM identity keys for nested node renders — **not** for widget value
 * lookup. Widget identity routes through {@link WidgetEntityId}.
 */
export function extractRawNodeId(scopedId: NodeId | string): NodeId {
  return String(scopedId).replace(/^(.*:)+/, '') as NodeId
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  function registerWidget<TValue = unknown>(
    widgetId: WidgetEntityId,
    state: WidgetState<TValue>
  ): WidgetState<TValue> {
    const world = getWorld()
    const { graphId, nodeId } = parseWidgetEntityId(widgetId)

    world.setComponent(widgetId, WidgetComponentValue, { value: state.value })
    world.setComponent(widgetId, WidgetComponentDisplay, {
      label: state.label,
      disabled: state.disabled ?? false
    })
    world.setComponent(widgetId, WidgetComponentSchema, {
      type: state.type,
      options: state.options
    })
    world.setComponent(widgetId, WidgetComponentSerialize, {
      serialize: state.serialize
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

    return buildView(widgetId) as WidgetState<TValue>
  }

  /**
   * Build a delegating view object for a widget entity. The view owns no
   * data — every accessor routes through the world. Getters assert the
   * underlying bucket exists; setters silently no-op when the bucket is
   * missing (post-`clearGraph` safety) and never re-create buckets.
   */
  function buildView(widgetId: WidgetEntityId): WidgetState {
    const world = getWorld()

    function read<T>(key: ComponentKey<T, WidgetEntityId>): T {
      const bucket = world.getComponent(widgetId, key)
      if (!bucket) {
        throw new Error(
          `Widget ${widgetId} missing component ${key.name}; view is invalid (likely accessed after clearGraph).`
        )
      }
      return bucket
    }

    return {
      get value() {
        return read(WidgetComponentValue).value
      },
      set value(v: unknown) {
        const bucket = world.getComponent(widgetId, WidgetComponentValue)
        if (bucket) bucket.value = v
      },
      get label() {
        return read(WidgetComponentDisplay).label
      },
      set label(v: string | undefined) {
        const bucket = world.getComponent(widgetId, WidgetComponentDisplay)
        if (bucket) bucket.label = v
      },
      get disabled() {
        return read(WidgetComponentDisplay).disabled
      },
      set disabled(v: boolean | undefined) {
        const bucket = world.getComponent(widgetId, WidgetComponentDisplay)
        if (bucket) bucket.disabled = v ?? false
      },
      get type() {
        return read(WidgetComponentSchema).type
      },
      get options() {
        return read(WidgetComponentSchema).options
      },
      get serialize() {
        return read(WidgetComponentSerialize).serialize
      }
    }
  }

  function getWidget(widgetId: WidgetEntityId): WidgetState | undefined {
    const world = getWorld()
    if (!world.getComponent(widgetId, WidgetComponentValue)) return undefined
    return buildView(widgetId)
  }

  function getNodeWidgets(nodeId: NodeEntityId): WidgetState[] {
    const world = getWorld()
    const container = world.getComponent(nodeId, WidgetComponentContainer)
    if (!container) return []
    const widgets: WidgetState[] = []
    for (const widgetId of container.widgetIds) {
      if (world.getComponent(widgetId, WidgetComponentValue)) {
        widgets.push(buildView(widgetId))
      }
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
      if (!world.getComponent(widgetId, WidgetComponentValue)) continue
      const { name } = parseWidgetEntityId(widgetId)
      result.set(name, buildView(widgetId))
    }
    return result
  }

  function setValue(
    widgetId: WidgetEntityId,
    value: WidgetState['value']
  ): boolean {
    const world = getWorld()
    const component = world.getComponent(widgetId, WidgetComponentValue)
    if (!component) return false
    component.value = value
    return true
  }

  function clearGraph(graphId: UUID): void {
    const world = getWorld()
    const branded = asGraphId(graphId)
    for (const widgetId of world.entitiesWith(WidgetComponentValue)) {
      if (isWidgetIdForGraph(branded, widgetId)) {
        world.removeComponent(widgetId, WidgetComponentValue)
        world.removeComponent(widgetId, WidgetComponentDisplay)
        world.removeComponent(widgetId, WidgetComponentSchema)
        world.removeComponent(widgetId, WidgetComponentSerialize)
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
