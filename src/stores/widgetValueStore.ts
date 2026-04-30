import { defineStore } from 'pinia'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import type { ComponentKey } from '@/world/componentKey'
import {
  asGraphId,
  isNodeIdForGraph,
  isWidgetIdForGraph,
  nodeEntityId,
  parseWidgetEntityId,
  widgetEntityId
} from '@/world/entityIds'
import type { WidgetEntityId } from '@/world/entityIds'
import { getWorld } from '@/world/worldInstance'

import {
  WidgetComponentContainer,
  WidgetComponentDisplay,
  WidgetComponentSchema,
  WidgetComponentSerialize,
  WidgetComponentValue
} from './widgetComponents'

/**
 * Strips graph/subgraph prefixes from a scoped node ID to get the bare node ID.
 * e.g., "graph1:subgraph2:42" → "42"
 */
export function stripGraphPrefix(scopedId: NodeId | string): NodeId {
  return String(scopedId).replace(/^(.*:)+/, '') as NodeId
}

/**
 * `WidgetState` is a *derived view* over the four widget-side components
 * (`WidgetComponentValue` / `Display` / `Schema` / `Serialize`). Property
 * accessors are installed via `Object.defineProperty` and delegate live
 * to the world; reads always hit the underlying reactive proxies, so
 * Vue tracking propagates through the view.
 *
 * Object identity is **not** preserved across `getWidget` calls — each
 * call constructs a fresh view. Data semantics round-trip; identity does
 * not. Do not cache views or rely on `===`.
 *
 * `name` and `nodeId` are not present on the view: they live in the
 * underlying `WidgetEntityId` and would be a redundant copy here. Callers
 * that need them should derive from the entity id (or from the BaseWidget
 * instance, which still owns them).
 */
export type WidgetState<
  TValue = unknown,
  TType extends string = string,
  TOptions extends IWidgetOptions = IWidgetOptions
> = Pick<
  IBaseWidget<TValue, TType, TOptions>,
  'value' | 'options' | 'label' | 'serialize' | 'disabled' | 'type'
>

/**
 * Input shape for `registerWidget`: a `WidgetState` view augmented with the
 * identity fields (`name`, `nodeId`) needed to construct the widget's
 * `WidgetEntityId`. The view returned from `registerWidget` is the
 * un-augmented `WidgetState` because identity fields live in the entity id.
 */
export interface WidgetRegistration<
  TValue = unknown
> extends WidgetState<TValue> {
  name: string
  nodeId: NodeId
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  function registerWidget<TValue = unknown>(
    graphId: UUID,
    state: WidgetRegistration<TValue>
  ): WidgetState<TValue> {
    const world = getWorld()
    const branded = asGraphId(graphId)
    const widgetId = widgetEntityId(branded, state.nodeId, state.name)

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

    const ownerId = nodeEntityId(branded, state.nodeId)
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

  /** First registration wins; later `state` seeds are discarded. */
  function getOrRegister(graphId: UUID, state: WidgetState): WidgetState {
    const existing = getWidget(graphId, state.nodeId, state.name)
    if (existing) return existing
    return registerWidget(graphId, state)
  }

  function getWidget(
    graphId: UUID,
    nodeId: NodeId,
    widgetName: string
  ): WidgetState | undefined {
    const world = getWorld()
    const widgetId = widgetEntityId(asGraphId(graphId), nodeId, widgetName)
    if (!world.getComponent(widgetId, WidgetComponentValue)) return undefined
    return buildView(widgetId)
  }

  function getNodeWidgets(graphId: UUID, nodeId: NodeId): WidgetState[] {
    const world = getWorld()
    const ownerId = nodeEntityId(asGraphId(graphId), nodeId)
    const container = world.getComponent(ownerId, WidgetComponentContainer)
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
    graphId: UUID,
    nodeId: NodeId
  ): Map<string, WidgetState> {
    const world = getWorld()
    const ownerId = nodeEntityId(asGraphId(graphId), nodeId)
    const container = world.getComponent(ownerId, WidgetComponentContainer)
    const result = new Map<string, WidgetState>()
    if (!container) return result
    for (const widgetId of container.widgetIds) {
      if (!world.getComponent(widgetId, WidgetComponentValue)) continue
      const { name } = parseWidgetEntityId(widgetId)
      result.set(name, buildView(widgetId))
    }
    return result
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
    getOrRegister,
    getWidget,
    getNodeWidgets,
    getNodeWidgetsByName,
    clearGraph
  }
})
