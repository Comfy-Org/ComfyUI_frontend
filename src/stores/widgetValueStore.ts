import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'

/**
 * Widget state is keyed by `nodeId:widgetName` without graph context.
 * This is intentional: nodes viewed at different subgraph depths share
 * the same widget state, enabling synchronized values across the hierarchy.
 */
type WidgetKey = `${NodeId}:${string}`

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

  function makeKey(nodeId: NodeId, widgetName: string): WidgetKey {
    return `${nodeId}:${widgetName}`
  }

  /**
   * @deprecated Use `ensureWidgetState(widget.entityId, init)` from
   * `src/world/widgetValueIO.ts`. Passing a loose `(graphId, nodeId, name)`
   * triple lets producers and consumers drift; `WidgetEntityId` is branded so
   * a mismatch becomes a type error.
   */
  function registerWidget<TValue = unknown>(
    graphId: UUID,
    state: WidgetState<TValue>
  ): WidgetState<TValue> {
    const widgetStates = getWidgetStateMap(graphId)
    const key = makeKey(state.nodeId, state.name)
    widgetStates.set(key, state)
    return widgetStates.get(key) as WidgetState<TValue>
  }

  function getNodeWidgets(graphId: UUID, nodeId: NodeId): WidgetState[] {
    const widgetStates = getWidgetStateMap(graphId)
    const prefix = `${nodeId}:`
    return [...widgetStates]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, state]) => state)
  }

  /**
   * @deprecated Use `getWidgetState(widget.entityId)` or
   * `readWidgetValue(widget.entityId)` from `src/world/widgetValueIO.ts`.
   * Passing a loose `(graphId, nodeId, name)` triple lets producers and
   * consumers drift; `WidgetEntityId` is branded so a mismatch becomes a type
   * error.
   */
  function getWidget(
    graphId: UUID,
    nodeId: NodeId,
    widgetName: string
  ): WidgetState | undefined {
    return getWidgetStateMap(graphId).get(makeKey(nodeId, widgetName))
  }

  /**
   * Write a new value to an already-registered widget. Returns `true` if the
   * widget was registered and updated, `false` if no such state exists.
   *
   * Prefer `writeWidgetValue(widget.entityId, value)` from
   * `src/world/widgetValueIO.ts`, which delegates here. Direct callers must
   * pass a matching `(graphId, nodeId, name)` triple.
   */
  function setValue(
    graphId: UUID,
    nodeId: NodeId,
    widgetName: string,
    value: WidgetState['value']
  ): boolean {
    const state = getWidgetStateMap(graphId).get(makeKey(nodeId, widgetName))
    if (!state) return false
    state.value = value
    return true
  }

  function clearGraph(graphId: UUID): void {
    graphWidgetStates.value.delete(graphId)
  }

  return {
    registerWidget,
    getWidget,
    setValue,
    getNodeWidgets,
    clearGraph
  }
})
