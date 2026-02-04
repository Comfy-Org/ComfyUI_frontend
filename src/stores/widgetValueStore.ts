import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'

type WidgetKey = `${NodeId}:${string}`

export interface WidgetState<
  TValue = unknown,
  TType extends string = string,
  TOptions extends IWidgetOptions<unknown> = IWidgetOptions<unknown>
> extends Pick<
  IBaseWidget<TValue, TType, TOptions>,
  | 'name'
  | 'type'
  | 'value'
  | 'options'
  | 'label'
  | 'serialize'
  | 'disabled'
  | 'hidden'
  | 'advanced'
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
    return state
  }

  function unregisterWidget(nodeId: NodeId, widgetName: string): void {
    widgetStates.value.delete(makeKey(nodeId, widgetName))
  }

  function unregisterNode(nodeId: NodeId): void {
    const prefix = `${nodeId}:`
    for (const key of widgetStates.value.keys()) {
      if (key.startsWith(prefix)) {
        widgetStates.value.delete(key)
      }
    }
  }

  function getWidget(
    nodeId: NodeId,
    widgetName: string
  ): WidgetState | undefined {
    return widgetStates.value.get(makeKey(nodeId, widgetName))
  }

  function getNodeWidgets(nodeId: NodeId): WidgetState[] {
    const prefix = `${nodeId}:`
    const result: WidgetState[] = []
    for (const [key, state] of widgetStates.value) {
      if (key.startsWith(prefix)) {
        result.push(state)
      }
    }
    return result
  }

  function getVisibleWidgets(nodeId: NodeId): WidgetState[] {
    return getNodeWidgets(nodeId).filter((w) => !w.hidden)
  }

  function getAdvancedWidgets(nodeId: NodeId): WidgetState[] {
    return getNodeWidgets(nodeId).filter((w) => w.advanced)
  }

  function getPromotedWidgets(nodeId: NodeId): WidgetState[] {
    return getNodeWidgets(nodeId).filter((w) => w.promoted)
  }

  function setHidden(
    nodeId: NodeId,
    widgetName: string,
    hidden: boolean
  ): void {
    const state = getWidget(nodeId, widgetName)
    if (state) {
      state.hidden = hidden
    }
  }

  function setDisabled(
    nodeId: NodeId,
    widgetName: string,
    disabled: boolean
  ): void {
    const state = getWidget(nodeId, widgetName)
    if (state) {
      state.disabled = disabled
    }
  }

  function setAdvanced(
    nodeId: NodeId,
    widgetName: string,
    advanced: boolean
  ): void {
    const state = getWidget(nodeId, widgetName)
    if (state) {
      state.advanced = advanced
    }
  }

  function setPromoted(
    nodeId: NodeId,
    widgetName: string,
    promoted: boolean
  ): void {
    const state = getWidget(nodeId, widgetName)
    if (state) {
      state.promoted = promoted
    }
  }

  function setLabel(
    nodeId: NodeId,
    widgetName: string,
    label: string | undefined
  ): void {
    const state = getWidget(nodeId, widgetName)
    if (state) {
      state.label = label
    }
  }

  return {
    widgetStates,
    registerWidget,
    unregisterWidget,
    unregisterNode,
    getWidget,
    getNodeWidgets,
    getVisibleWidgets,
    getAdvancedWidgets,
    getPromotedWidgets,
    setHidden,
    setDisabled,
    setAdvanced,
    setPromoted,
    setLabel
  }
})
