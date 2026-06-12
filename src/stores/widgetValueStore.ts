import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/utils/uuid'
import { parseWidgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import type {
  WidgetControlState,
  WidgetState,
  WidgetStateInit
} from '@/types/widgetState'

export function stripGraphPrefix(scopedId: NodeId | string): NodeId {
  return String(scopedId).replace(/^(.*:)+/, '') as NodeId
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  const graphWidgetStates = ref(new Map<UUID, Map<WidgetId, WidgetState>>())
  const graphWidgetControls = ref(
    new Map<UUID, Map<WidgetId, WidgetControlState>>()
  )

  function getGraphWidgetStates(graphId: UUID): Map<WidgetId, WidgetState> {
    const widgetStates = graphWidgetStates.value.get(graphId)
    if (widgetStates) return widgetStates

    const nextWidgetStates = reactive(new Map<WidgetId, WidgetState>())
    graphWidgetStates.value.set(graphId, nextWidgetStates)
    return nextWidgetStates
  }

  function getGraphWidgetControls(
    graphId: UUID
  ): Map<WidgetId, WidgetControlState> {
    const controls = graphWidgetControls.value.get(graphId)
    if (controls) return controls

    const nextControls = reactive(new Map<WidgetId, WidgetControlState>())
    graphWidgetControls.value.set(graphId, nextControls)
    return nextControls
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

  function getWidget(widgetId: WidgetId): WidgetState | undefined {
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
    const { graphId } = parseWidgetId(widgetId)
    deleteWidgetControl(widgetId)
    return getGraphWidgetStates(graphId).delete(widgetId)
  }

  function registerWidgetControl(
    targetId: WidgetId,
    control: Omit<WidgetControlState, 'hasExecuted'>
  ): WidgetControlState {
    const { graphId } = parseWidgetId(targetId)
    const controls = getGraphWidgetControls(graphId)
    const existing = controls.get(targetId)
    const hasExecuted =
      existing?.controlWidgetId === control.controlWidgetId &&
      existing?.filterWidgetId === control.filterWidgetId
        ? existing.hasExecuted
        : false
    const state: WidgetControlState = { ...control, hasExecuted }
    controls.set(targetId, state)
    return controls.get(targetId) as WidgetControlState
  }

  function getWidgetControls(graphId: UUID): [WidgetId, WidgetControlState][] {
    return [...getGraphWidgetControls(graphId).entries()]
  }

  function deleteWidgetControl(targetId: WidgetId): boolean {
    const { graphId } = parseWidgetId(targetId)
    return getGraphWidgetControls(graphId).delete(targetId)
  }

  function getNodeWidgets(graphId: UUID, nodeId: NodeId): WidgetState[] {
    return [...getGraphWidgetStates(graphId).values()].filter(
      (state) => String(state.nodeId) === String(nodeId)
    )
  }

  function clearGraph(graphId: UUID): void {
    graphWidgetStates.value.delete(graphId)
    graphWidgetControls.value.delete(graphId)
  }

  return {
    registerWidget,
    getWidget,
    setValue,
    deleteWidget,
    registerWidgetControl,
    getWidgetControls,
    deleteWidgetControl,
    getNodeWidgets,
    clearGraph
  }
})
