import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { UUID } from '@/utils/uuid'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { parseWidgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import type { WidgetValue } from '@/types/simplifiedWidget'
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
  const graphNodeWidgetOrders = ref(new Map<UUID, Map<NodeId, WidgetId[]>>())

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

  function getGraphNodeWidgetOrders(graphId: UUID): Map<NodeId, WidgetId[]> {
    const widgetOrders = graphNodeWidgetOrders.value.get(graphId)
    if (widgetOrders) return widgetOrders

    const nextWidgetOrders = reactive(new Map<NodeId, WidgetId[]>())
    graphNodeWidgetOrders.value.set(graphId, nextWidgetOrders)
    return nextWidgetOrders
  }

  function getNodeWidgetOrder(graphId: UUID, nodeId: NodeId): WidgetId[] {
    const graphOrders = getGraphNodeWidgetOrders(graphId)
    const order = graphOrders.get(nodeId)
    if (order) return order

    const nextOrder = reactive<WidgetId[]>([])
    graphOrders.set(nodeId, nextOrder)
    return nextOrder
  }

  function appendNodeWidgetOrder(widgetId: WidgetId): void {
    const { graphId, nodeId } = parseWidgetId(widgetId)
    const order = getNodeWidgetOrder(graphId, nodeId)
    if (!order.includes(widgetId)) order.push(widgetId)
  }

  function removeNodeWidgetOrder(widgetId: WidgetId): void {
    const { graphId, nodeId } = parseWidgetId(widgetId)
    const graphOrders = getGraphNodeWidgetOrders(graphId)
    const order = graphOrders.get(nodeId)
    if (!order) return

    const index = order.indexOf(widgetId)
    if (index !== -1) order.splice(index, 1)
    if (order.length === 0) graphOrders.delete(nodeId)
  }

  function registerWidget<TValue extends WidgetValue = WidgetValue>(
    widgetId: WidgetId,
    init: WidgetStateInit<TValue>,
    renderState: WidgetRenderState = {}
  ): WidgetState<TValue> {
    registerWidgetRenderState(widgetId, renderState)

    const existing = getWidget(widgetId)
    if (existing) {
      appendNodeWidgetOrder(widgetId)
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
    appendNodeWidgetOrder(widgetId)
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
    removeNodeWidgetOrder(widgetId)
    return getGraphWidgetStates(graphId).delete(widgetId)
  }

  function getNodeWidgets(graphId: UUID, localNodeId: NodeId): WidgetState[] {
    return getNodeWidgetIds(graphId, localNodeId).flatMap((id) => {
      const state = getWidget(id)
      return state ? [state] : []
    })
  }

  /**
   * Merges a requested widget order against the ids already tracked for the
   * node: the request is filtered to tracked ids, then any tracked id the
   * request omitted is appended. Tracked ids are never dropped here — only
   * {@link removeNodeWidgetOrder} removes an id from the order.
   */
  function reconcileNodeWidgetOrder(
    graphId: UUID,
    localNodeId: NodeId,
    orderedWidgetIds: readonly WidgetId[]
  ): WidgetId[] {
    const currentOrder = getNodeWidgetIds(graphId, localNodeId)
    const currentIds = new Set(currentOrder)
    const nextOrder = orderedWidgetIds.filter((id) => currentIds.has(id))
    const nextIds = new Set(nextOrder)
    return [...nextOrder, ...currentOrder.filter((id) => !nextIds.has(id))]
  }

  function getNodeWidgetIds(graphId: UUID, localNodeId: NodeId): WidgetId[] {
    return [...getNodeWidgetOrder(graphId, localNodeId)]
  }

  function setNodeWidgetOrder(
    graphId: UUID,
    localNodeId: NodeId,
    orderedWidgetIds: readonly WidgetId[]
  ): void {
    const nextOrder = reconcileNodeWidgetOrder(
      graphId,
      localNodeId,
      orderedWidgetIds
    )
    const order = getNodeWidgetOrder(graphId, localNodeId)
    order.splice(0, order.length, ...nextOrder)
  }

  function clearGraph(graphId: UUID): void {
    graphWidgetStates.value.delete(graphId)
    graphWidgetRenderStates.value.delete(graphId)
    graphNodeWidgetOrders.value.delete(graphId)
  }

  return {
    registerWidget,
    getWidget,
    getWidgetRenderState,
    setValue,
    deleteWidget,
    getNodeWidgets,
    getNodeWidgetIds,
    setNodeWidgetOrder,
    removeNodeWidgetOrder,
    clearGraph
  }
})
