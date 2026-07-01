import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { UUID } from '@/utils/uuid'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { parseWidgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import type { WidgetState, WidgetStateInit } from '@/types/widgetState'

export interface WidgetRenderState {
  advanced?: boolean
  hasLayoutSize?: boolean
  isDOMWidget?: boolean
  tooltip?: string
}

export function stripGraphPrefix(scopedId: SerializedNodeId): NodeId | null {
  return parseNodeId(String(scopedId).replace(/^(.*:)+/, ''))
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  const graphWidgetStates = ref(new Map<UUID, Map<WidgetId, WidgetState>>())
  const graphWidgetRenderStates = ref(
    new Map<UUID, Map<WidgetId, WidgetRenderState>>()
  )

  function getGraphWidgetStates(graphId: UUID): Map<WidgetId, WidgetState> {
    const widgetStates = graphWidgetStates.value.get(graphId)
    if (widgetStates) return widgetStates

    const nextWidgetStates = reactive(new Map<WidgetId, WidgetState>())
    graphWidgetStates.value.set(graphId, nextWidgetStates)
    return nextWidgetStates
  }

  function getGraphWidgetRenderStates(
    graphId: UUID
  ): Map<WidgetId, WidgetRenderState> {
    const widgetRenderStates = graphWidgetRenderStates.value.get(graphId)
    if (widgetRenderStates) return widgetRenderStates

    const nextWidgetRenderStates = reactive(
      new Map<WidgetId, WidgetRenderState>()
    )
    graphWidgetRenderStates.value.set(graphId, nextWidgetRenderStates)
    return nextWidgetRenderStates
  }

  function registerWidget<TValue = unknown>(
    widgetId: WidgetId,
    init: WidgetStateInit<TValue>
  ): WidgetState<TValue> {
    const existing = getWidget(widgetId)
    if (existing) return existing as WidgetState<TValue>

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

  function registerWidgetRenderState(
    widgetId: WidgetId,
    init: WidgetRenderState
  ): WidgetRenderState {
    const { graphId } = parseWidgetId(widgetId)
    const widgetRenderStates = getGraphWidgetRenderStates(graphId)
    const existing = widgetRenderStates.get(widgetId)
    if (existing) {
      Object.assign(existing, init)
      return existing
    }

    const state: WidgetRenderState = { ...init }
    widgetRenderStates.set(widgetId, state)
    return widgetRenderStates.get(widgetId) as WidgetRenderState
  }

  function getWidget(widgetId: WidgetId): WidgetState | undefined {
    const { graphId } = parseWidgetId(widgetId)
    return getGraphWidgetStates(graphId).get(widgetId)
  }

  function getWidgetRenderState(
    widgetId: WidgetId
  ): WidgetRenderState | undefined {
    const { graphId } = parseWidgetId(widgetId)
    return getGraphWidgetRenderStates(graphId).get(widgetId)
  }

  function setValue(widgetId: WidgetId, value: WidgetState['value']): boolean {
    const state = getWidget(widgetId)
    if (!state) return false
    state.value = value
    return true
  }

  function deleteWidget(widgetId: WidgetId): boolean {
    const { graphId } = parseWidgetId(widgetId)
    getGraphWidgetRenderStates(graphId).delete(widgetId)
    return getGraphWidgetStates(graphId).delete(widgetId)
  }

  function getNodeWidgets(graphId: UUID, localNodeId: NodeId): WidgetState[] {
    return [...getGraphWidgetStates(graphId).values()].filter(
      (state) => state.nodeId === localNodeId
    )
  }

  function getNodeWidgetIds(graphId: UUID, localNodeId: NodeId): WidgetId[] {
    return [...getGraphWidgetStates(graphId).entries()]
      .filter(([, state]) => state.nodeId === localNodeId)
      .map(([id]) => id)
  }

  function clearGraph(graphId: UUID): void {
    graphWidgetStates.value.delete(graphId)
    graphWidgetRenderStates.value.delete(graphId)
  }

  return {
    registerWidget,
    registerWidgetRenderState,
    getWidget,
    getWidgetRenderState,
    setValue,
    deleteWidget,
    getNodeWidgets,
    getNodeWidgetIds,
    clearGraph
  }
})
