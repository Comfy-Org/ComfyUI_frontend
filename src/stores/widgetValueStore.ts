import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { UUID } from '@/utils/uuid'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { isWidgetId, parseWidgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import type { WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetState, WidgetStateInit } from '@/types/widgetState'

export interface WidgetRenderState {
  advanced?: boolean
  hasLayoutSize?: boolean
  isDOMWidget?: boolean
  tooltip?: string
}

interface WidgetRestorationState {
  positional: readonly WidgetValue[]
  named?: Readonly<Record<string, WidgetValue>>
  restoreNamed: boolean
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
  const graphWidgetRestorations = new Map<
    UUID,
    Map<NodeId, WidgetRestorationState>
  >()

  function setNodeWidgetRestoration(
    graphId: UUID,
    nodeId: NodeId,
    restoration: WidgetRestorationState
  ): void {
    let graphRestorations = graphWidgetRestorations.get(graphId)
    if (!graphRestorations) {
      graphRestorations = new Map()
      graphWidgetRestorations.set(graphId, graphRestorations)
    }
    graphRestorations.set(nodeId, restoration)
  }

  function getRestoredWidgetValue(
    graphId: UUID,
    nodeId: NodeId,
    name: string,
    positionalIndex: number
  ): { value: WidgetValue } | undefined {
    const restoration = graphWidgetRestorations.get(graphId)?.get(nodeId)
    if (!restoration) return
    if (restoration.restoreNamed && restoration.named) {
      return Object.hasOwn(restoration.named, name)
        ? { value: restoration.named[name] }
        : undefined
    }
    return positionalIndex < restoration.positional.length
      ? { value: restoration.positional[positionalIndex] }
      : undefined
  }

  function getPositionalRestoredWidgetValue(
    graphId: UUID,
    nodeId: NodeId,
    positionalIndex: number
  ): WidgetValue | undefined {
    return graphWidgetRestorations.get(graphId)?.get(nodeId)?.positional[
      positionalIndex
    ]
  }

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
    const graphOrders = graphNodeWidgetOrders.value.get(graphId)
    if (!graphOrders) return
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
  ): WidgetState<TValue> | undefined {
    if (!isWidgetId(widgetId)) {
      console.warn(
        'widgetValueStore.registerWidget: ignoring un-keyable widget id',
        widgetId
      )
      return undefined
    }

    const existing = getWidget(widgetId)
    const { graphId, nodeId, name: storageName } = parseWidgetId(widgetId)
    if (existing && existing.type !== init.type) {
      getGraphWidgetRenderStates(graphId).delete(widgetId)
    }
    registerWidgetRenderState(widgetId, renderState)
    // WidgetId is `graphId:nodeId:name`. A node replacement can reuse the same
    // numeric nodeId, so a stale entry from the previous occupant may survive in
    // the store under the same key. The type check distinguishes a live
    // re-registration (same widget, keep its value) from a recycled key (new
    // widget type at an old address, overwrite). Without it a text widget
    // rendered as the prior int type until the next full reload (#13073, #13773).
    if (existing && existing.type === init.type) {
      const value = existing.value
      Object.assign(existing, init, {
        name: init.name ?? storageName,
        nodeId,
        value,
        y: init.y ?? existing.y
      })
      appendNodeWidgetOrder(widgetId)
      return existing as WidgetState<TValue>
    }

    const state: WidgetState<TValue> = {
      ...init,
      nodeId,
      name: init.name ?? storageName,
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
    if (!isWidgetId(widgetId)) return undefined

    const { graphId } = parseWidgetId(widgetId)
    return graphWidgetStates.value.get(graphId)?.get(widgetId)
  }

  function getWidgetRenderState(
    widgetId: WidgetId
  ): WidgetRenderState | undefined {
    if (!isWidgetId(widgetId)) return undefined

    const { graphId } = parseWidgetId(widgetId)
    return graphWidgetRenderStates.value.get(graphId)?.get(widgetId)
  }

  function setValue(widgetId: WidgetId, value: WidgetState['value']): boolean {
    const state = getWidget(widgetId)
    if (!state) return false
    state.value = value
    return true
  }

  function setLabel(widgetId: WidgetId, label: string): boolean {
    const state = getWidget(widgetId)
    if (!state) return false
    state.label = label
    return true
  }

  function updateOptions(
    widgetId: WidgetId,
    options: Partial<WidgetState['options']>
  ): boolean {
    const state = getWidget(widgetId)
    if (!state) return false
    state.options = { ...state.options, ...options }
    return true
  }

  function deleteWidget(widgetId: WidgetId): boolean {
    if (!isWidgetId(widgetId)) return false

    const { graphId } = parseWidgetId(widgetId)
    graphWidgetRenderStates.value.get(graphId)?.delete(widgetId)
    removeNodeWidgetOrder(widgetId)
    return graphWidgetStates.value.get(graphId)?.delete(widgetId) ?? false
  }

  function renameWidget(
    oldId: WidgetId,
    newId: WidgetId
  ): WidgetState | undefined {
    if (!isWidgetId(oldId) || !isWidgetId(newId)) return undefined
    if (oldId === newId) return getWidget(oldId)

    const previous = parseWidgetId(oldId)
    const next = parseWidgetId(newId)
    if (previous.graphId !== next.graphId) return undefined
    if (previous.nodeId !== next.nodeId) return undefined

    const { graphId, nodeId, name } = next
    const widgetStates = getGraphWidgetStates(graphId)
    const state = widgetStates.get(oldId)
    if (!state) return undefined
    if (widgetStates.has(newId)) return undefined

    const renderStates = getGraphWidgetRenderStates(graphId)
    const renderState = renderStates.get(oldId)
    const order = getNodeWidgetOrder(graphId, nodeId)
    const index = order.indexOf(oldId)

    widgetStates.delete(oldId)
    renderStates.delete(oldId)
    if (index !== -1) order.splice(index, 1)

    state.name = name
    widgetStates.set(newId, state)
    if (renderState) renderStates.set(newId, renderState)
    if (index !== -1) order.splice(index, 0, newId)
    else if (!order.includes(newId)) order.push(newId)

    return widgetStates.get(newId)
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
    return [
      ...(graphNodeWidgetOrders.value.get(graphId)?.get(localNodeId) ?? [])
    ]
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

  function replaceNodeWidgetOrder(
    graphId: UUID,
    localNodeId: NodeId,
    orderedWidgetIds: readonly WidgetId[]
  ): void {
    const widgetStates = getGraphWidgetStates(graphId)
    const nextOrder = orderedWidgetIds.filter(
      (id) => widgetStates.get(id)?.nodeId === localNodeId
    )
    const graphOrders = getGraphNodeWidgetOrders(graphId)
    const order = graphOrders.get(localNodeId)

    if (nextOrder.length === 0) {
      graphOrders.delete(localNodeId)
    } else if (order) {
      order.splice(0, order.length, ...nextOrder)
    } else {
      graphOrders.set(localNodeId, reactive([...nextOrder]))
    }
  }

  /**
   * Releases the widget ids tracked for a node, from the store's own record
   * rather than the node's live widget list — the two diverge once a node drops
   * widgets without unregistering them. `discardValues` also drops the widget
   * states; retaining them lets a node that comes back keep what the user set.
   */
  function releaseNodeWidgets(
    graphId: UUID,
    localNodeId: NodeId,
    { discardValues }: { discardValues: boolean }
  ): void {
    const graphOrders = graphNodeWidgetOrders.value.get(graphId)
    if (!graphOrders) return

    const order = graphOrders.get(localNodeId)
    if (!order) return

    if (discardValues) {
      for (const widgetId of order) {
        graphWidgetStates.value.get(graphId)?.delete(widgetId)
        graphWidgetRenderStates.value.get(graphId)?.delete(widgetId)
      }
    }
    graphOrders.delete(localNodeId)
  }

  function clearNode(graphId: UUID, nodeId: NodeId): void {
    graphWidgetRestorations.get(graphId)?.delete(nodeId)
    const widgetStates = graphWidgetStates.value.get(graphId)
    const widgetRenderStates = graphWidgetRenderStates.value.get(graphId)
    if (widgetStates) {
      for (const [id, state] of widgetStates) {
        if (state.nodeId !== nodeId) continue
        widgetStates.delete(id)
        widgetRenderStates?.delete(id)
      }
      if (widgetStates.size === 0) graphWidgetStates.value.delete(graphId)
    }
    if (widgetRenderStates?.size === 0) {
      graphWidgetRenderStates.value.delete(graphId)
    }

    const widgetOrders = graphNodeWidgetOrders.value.get(graphId)
    widgetOrders?.delete(nodeId)
    if (widgetOrders?.size === 0) graphNodeWidgetOrders.value.delete(graphId)
  }

  function clearGraph(graphId: UUID): void {
    graphWidgetStates.value.delete(graphId)
    graphWidgetRenderStates.value.delete(graphId)
    graphNodeWidgetOrders.value.delete(graphId)
    graphWidgetRestorations.delete(graphId)
  }

  return {
    registerWidget,
    setNodeWidgetRestoration,
    getRestoredWidgetValue,
    getPositionalRestoredWidgetValue,
    getWidget,
    getWidgetRenderState,
    setValue,
    setLabel,
    updateOptions,
    deleteWidget,
    renameWidget,
    getNodeWidgets,
    getNodeWidgetIds,
    setNodeWidgetOrder,
    replaceNodeWidgetOrder,
    removeNodeWidgetOrder,
    releaseNodeWidgets,
    clearNode,
    clearGraph
  }
})
