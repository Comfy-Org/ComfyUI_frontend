import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { UUID } from '@/utils/uuid'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { isWidgetId, parseWidgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import type { WidgetState, WidgetStateInit } from '@/types/widgetState'

export function stripGraphPrefix(scopedId: SerializedNodeId): NodeId | null {
  return parseNodeId(String(scopedId).replace(/^(.*:)+/, ''))
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  const graphWidgetStates = ref(new Map<UUID, Map<WidgetId, WidgetState>>())

  function getGraphWidgetStates(graphId: UUID): Map<WidgetId, WidgetState> {
    const widgetStates = graphWidgetStates.value.get(graphId)
    if (widgetStates) return widgetStates

    const nextWidgetStates = reactive(new Map<WidgetId, WidgetState>())
    graphWidgetStates.value.set(graphId, nextWidgetStates)
    return nextWidgetStates
  }

  function registerWidget<TValue = unknown>(
    widgetId: WidgetId,
    init: WidgetStateInit<TValue>
  ): WidgetState<TValue> | undefined {
    if (!isWidgetId(widgetId)) {
      console.warn(
        'widgetValueStore.registerWidget: ignoring un-keyable widget id',
        widgetId
      )
      return undefined
    }

    const existing = getWidget(widgetId)
    if (existing && existing.type === init.type) {
      return existing as WidgetState<TValue>
    }

    const { graphId, nodeId, name } = parseWidgetId(widgetId)
    const state: WidgetState<TValue> = {
      ...init,
      nodeId,
      name,
      y: init.y ?? 0
    }
    const widgetStates = getGraphWidgetStates(graphId)
    widgetStates.set(widgetId, state)
    return widgetStates.get(widgetId) as WidgetState<TValue>
  }

  function getWidget(widgetId: WidgetId): WidgetState | undefined {
    if (!isWidgetId(widgetId)) return undefined

    const { graphId } = parseWidgetId(widgetId)
    return getGraphWidgetStates(graphId).get(widgetId)
  }

  function setValue(widgetId: WidgetId, value: WidgetState['value']): boolean {
    const state = getWidget(widgetId)
    if (!state) return false
    state.value = value
    return true
  }

  function deleteWidget(widgetId: WidgetId): boolean {
    if (!isWidgetId(widgetId)) return false

    const { graphId } = parseWidgetId(widgetId)
    return getGraphWidgetStates(graphId).delete(widgetId)
  }

  /**
   * Moves an existing widget state to a new id, preserving the state object
   * identity so any widget holding a reference to it stays in sync. Any state
   * already stored under `toId` is discarded.
   */
  function renameWidget(fromId: WidgetId, toId: WidgetId): boolean {
    if (fromId === toId) return false
    const { graphId: fromGraphId } = parseWidgetId(fromId)
    const state = getGraphWidgetStates(fromGraphId).get(fromId)
    if (!state) return false

    const { graphId: toGraphId, name } = parseWidgetId(toId)
    getGraphWidgetStates(fromGraphId).delete(fromId)
    state.name = name
    getGraphWidgetStates(toGraphId).set(toId, state)
    return true
  }

  function getNodeWidgets(graphId: UUID, localNodeId: NodeId): WidgetState[] {
    return [...getGraphWidgetStates(graphId).values()].filter(
      (state) => state.nodeId === localNodeId
    )
  }

  function clearGraph(graphId: UUID): void {
    graphWidgetStates.value.delete(graphId)
  }

  return {
    registerWidget,
    getWidget,
    setValue,
    deleteWidget,
    renameWidget,
    getNodeWidgets,
    clearGraph
  }
})
