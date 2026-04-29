import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'

/**
 * Widget state is keyed by `nodeId:widgetName` without graph context by
 * default. Promoted subgraph widgets can add an instance coordinate so sibling
 * SubgraphNode instances do not collide while regular depth views keep sharing
 * the legacy slot.
 */
type WidgetKey = `${NodeId}:${string}` | `${NodeId}@${NodeId}:${string}`

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
  const graphWidgetStates = ref(new Map<UUID, Map<WidgetKey, WidgetState>>())

  function getWidgetStateMap(graphId: UUID): Map<WidgetKey, WidgetState> {
    const widgetStates = graphWidgetStates.value.get(graphId)
    if (widgetStates) return widgetStates

    const nextWidgetStates = reactive(new Map<WidgetKey, WidgetState>())
    graphWidgetStates.value.set(graphId, nextWidgetStates)
    return nextWidgetStates
  }

  function makeKey(
    nodeId: NodeId,
    widgetName: string,
    instanceId?: NodeId
  ): WidgetKey {
    return instanceId === undefined
      ? `${nodeId}:${widgetName}`
      : `${instanceId}@${nodeId}:${widgetName}`
  }

  function registerWidget<TValue = unknown>(
    graphId: UUID,
    state: WidgetState<TValue>,
    instanceId?: NodeId
  ): WidgetState<TValue> {
    const widgetStates = getWidgetStateMap(graphId)
    const key = makeKey(state.nodeId, state.name, instanceId)
    widgetStates.set(key, state)
    return widgetStates.get(key) as WidgetState<TValue>
  }

  function getNodeWidgets(
    graphId: UUID,
    nodeId: NodeId,
    instanceId?: NodeId
  ): WidgetState[] {
    const widgetStates = getWidgetStateMap(graphId)
    const prefix =
      instanceId === undefined ? `${nodeId}:` : `${instanceId}@${nodeId}:`
    return [...widgetStates]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, state]) => state)
  }

  function getWidget(
    graphId: UUID,
    nodeId: NodeId,
    widgetName: string,
    instanceId?: NodeId
  ): WidgetState | undefined {
    return getWidgetStateMap(graphId).get(
      makeKey(nodeId, widgetName, instanceId)
    )
  }

  function clearInstanceWidgets(graphId: UUID, instanceId: NodeId): void {
    const widgetStates = getWidgetStateMap(graphId)
    const prefix = `${instanceId}@`
    for (const key of widgetStates.keys()) {
      if (key.startsWith(prefix)) widgetStates.delete(key)
    }
  }

  function clearGraph(graphId: UUID): void {
    graphWidgetStates.value.delete(graphId)
  }

  return {
    registerWidget,
    getWidget,
    getNodeWidgets,
    clearInstanceWidgets,
    clearGraph
  }
})
