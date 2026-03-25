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

type HydrationCallback = () => void

export const useWidgetValueStore = defineStore('widgetValue', () => {
  const graphWidgetStates = ref(new Map<UUID, Map<WidgetKey, WidgetState>>())
  const hydratingNodes = new Set<NodeId>()
  const hydrationCallbacks = new Map<NodeId, HydrationCallback[]>()

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

  function registerWidget<TValue = unknown>(
    graphId: UUID,
    state: WidgetState<TValue>
  ): WidgetState<TValue> {
    const widgetStates = getWidgetStateMap(graphId)
    const key = makeKey(state.nodeId, state.name)
    widgetStates.set(key, state)
    return widgetStates.get(key)!
  }

  function getNodeWidgets(graphId: UUID, nodeId: NodeId): WidgetState[] {
    const widgetStates = getWidgetStateMap(graphId)
    const prefix = `${nodeId}:`
    return [...widgetStates]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, state]) => state)
  }

  function getWidget(
    graphId: UUID,
    nodeId: NodeId,
    widgetName: string
  ): WidgetState | undefined {
    return getWidgetStateMap(graphId).get(makeKey(nodeId, widgetName))
  }

  function getOrCreateWidget(
    graphId: UUID,
    nodeId: NodeId,
    widgetName: string,
    defaultValue?: unknown
  ): WidgetState {
    const widgetStates = getWidgetStateMap(graphId)
    const key = makeKey(nodeId, widgetName)
    const existing = widgetStates.get(key)
    if (existing) return existing

    const state: WidgetState = {
      nodeId,
      name: widgetName,
      type: 'string',
      value: defaultValue,
      options: {}
    }
    widgetStates.set(key, state)
    return widgetStates.get(key)!
  }

  function beginHydration(nodeId: NodeId): void {
    hydratingNodes.add(nodeId)
  }

  function commitHydration(nodeId: NodeId): void {
    hydratingNodes.delete(nodeId)
    const callbacks = hydrationCallbacks.get(nodeId)
    if (callbacks) {
      hydrationCallbacks.delete(nodeId)
      for (const cb of callbacks) cb()
    }
  }

  function isHydrating(nodeId: NodeId): boolean {
    return hydratingNodes.has(nodeId)
  }

  function onHydrationComplete(nodeId: NodeId, callback: HydrationCallback) {
    if (!hydratingNodes.has(nodeId)) return callback()

    const existing = hydrationCallbacks.get(nodeId) ?? []
    if (!existing.includes(callback)) existing.push(callback)
    hydrationCallbacks.set(nodeId, existing)
  }

  function clearGraph(graphId: UUID): void {
    graphWidgetStates.value.delete(graphId)
  }

  return {
    registerWidget,
    getWidget,
    getOrCreateWidget,
    getNodeWidgets,
    beginHydration,
    commitHydration,
    isHydrating,
    onHydrationComplete,
    clearGraph
  }
})
