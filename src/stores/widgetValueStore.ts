import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
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
  | 'name'
  | 'type'
  | 'value'
  | 'options'
  | 'hidden'
  | 'label'
  | 'serialize'
  | 'disabled'
  | 'promoted'
> {
  nodeId: NodeId
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  const widgetStates = ref(new Map<WidgetKey, WidgetState>())

  function makeKey(nodeId: NodeId, widgetName: string): WidgetKey {
    return `${nodeId}:${widgetName}`
  }

  function registerWidget<TValue = unknown>(
    state: WidgetState<TValue>
  ): WidgetState<TValue> {
    const key = makeKey(state.nodeId, state.name)
    widgetStates.value.set(key, state)
    return widgetStates.value.get(key) as WidgetState<TValue>
  }

  function getNodeWidgets(nodeId: NodeId): WidgetState[] {
    const prefix = `${nodeId}:`
    return [...widgetStates.value]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, state]) => state)
  }

  function getWidget(
    nodeId: NodeId,
    widgetName: string
  ): WidgetState | undefined {
    return widgetStates.value.get(makeKey(nodeId, widgetName))
  }

  function resolvePromotedWidget(
    subgraph: LGraph,
    nodeId: NodeId,
    widgetName: string
  ): { state: WidgetState; widget: IBaseWidget; node: LGraphNode } | null {
    const node = subgraph.getNodeById(nodeId)
    if (!node) return null

    const widget = node.widgets?.find((w) => w.name === widgetName)
    if (!widget) return null

    const state = getWidget(stripGraphPrefix(nodeId), widgetName)
    if (!state) return null

    return { state, widget, node }
  }

  return {
    registerWidget,
    getWidget,
    getNodeWidgets,
    resolvePromotedWidget
  }
})
