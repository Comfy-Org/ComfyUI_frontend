import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type {
  NodeId,
  WidgetId,
  WidgetIdentity,
  WidgetRuntimeState
} from '@/types/widget'
import { getWidgetId } from '@/types/widget'

/**
 * Strips graph/subgraph prefixes from a scoped node ID to get the bare node ID.
 * e.g., "graph1:subgraph2:42" → "42"
 */
export function stripGraphPrefix(scopedId: NodeId | string): NodeId {
  const stripped = String(scopedId).replace(/^(.*:)+/, '')
  const num = Number(stripped)
  return Number.isNaN(num) ? stripped : num
}

/**
 * Extended widget state for the store, including type info and options.
 * Extends WidgetRuntimeState with additional fields needed for serialization.
 */
export interface WidgetState<
  TValue = unknown,
  TOptions extends IWidgetOptions<unknown> = IWidgetOptions<unknown>
> extends WidgetRuntimeState {
  value: TValue
  type?: string
  options?: TOptions
  serialize?: boolean
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  /**
   * Widget state is keyed by WidgetId (`nodeId:widgetName`) without graph context.
   * This is intentional: nodes viewed at different subgraph depths share
   * the same widget state, enabling synchronized values across the hierarchy.
   */
  const widgetStates = ref(new Map<WidgetId, WidgetState>())

  function registerWidget<TValue = unknown>(
    state: WidgetState<TValue>
  ): WidgetState<TValue> {
    const key = getWidgetId(state)
    widgetStates.value.set(key, state)
    return widgetStates.value.get(key) as WidgetState<TValue>
  }

  function getNodeWidgets(nodeId: NodeId): WidgetState[] {
    const prefix = `${nodeId}:`
    return [...widgetStates.value]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, state]) => state)
  }

  function getWidget(identity: WidgetIdentity): WidgetState | undefined
  function getWidget(
    nodeId: NodeId,
    widgetName: string
  ): WidgetState | undefined
  function getWidget(
    nodeIdOrIdentity: NodeId | WidgetIdentity,
    widgetName?: string
  ): WidgetState | undefined {
    if (typeof nodeIdOrIdentity === 'object') {
      return widgetStates.value.get(getWidgetId(nodeIdOrIdentity))
    }
    return widgetStates.value.get(
      getWidgetId({ nodeId: nodeIdOrIdentity, name: widgetName! })
    )
  }

  return {
    registerWidget,
    getWidget,
    getNodeWidgets
  }
})
