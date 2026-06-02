import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/utils/uuid'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'

type WidgetKey = `${NodeId}:${string}`

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
   * `src/world/widgetValueIO.ts` — the branded `WidgetEntityId` prevents
   * producer/consumer drift that loose triples allow.
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
   * `readWidgetValue(widget.entityId)` from `src/world/widgetValueIO.ts` —
   * the branded `WidgetEntityId` prevents producer/consumer drift that loose
   * triples allow.
   */
  function getWidget(
    graphId: UUID,
    nodeId: NodeId,
    widgetName: string
  ): WidgetState | undefined {
    return getWidgetStateMap(graphId).get(makeKey(nodeId, widgetName))
  }

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
