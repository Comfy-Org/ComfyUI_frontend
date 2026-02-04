import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  IWidgetOptions,
  TWidgetType
} from '@/lib/litegraph/src/types/widgets'

type WidgetKey = `${NodeId}:${string}`

export interface WidgetState {
  nodeId: NodeId
  name: string
  type: TWidgetType
  value: unknown
  label?: string
  hidden: boolean
  disabled: boolean
  advanced: boolean
  promoted: boolean
  options: IWidgetOptions<unknown>
  serialize: boolean
}

export const useWidgetValueStore = defineStore('widgetValue', () => {
  const values = ref(new Map<WidgetKey, unknown>())
  const widgetStates = ref(new Map<WidgetKey, WidgetState>())

  function makeKey(nodeId: NodeId, widgetName: string): WidgetKey {
    return `${nodeId}:${widgetName}`
  }

  function get(nodeId: NodeId, widgetName: string): unknown {
    return values.value.get(makeKey(nodeId, widgetName))
  }

  function set(nodeId: NodeId, widgetName: string, value: unknown): void {
    const key = makeKey(nodeId, widgetName)
    values.value.set(key, value)
    const state = widgetStates.value.get(key)
    if (state) {
      state.value = value
    }
  }

  function remove(nodeId: NodeId, widgetName: string): void {
    values.value.delete(makeKey(nodeId, widgetName))
  }

  function removeNode(nodeId: NodeId): void {
    const prefix = `${nodeId}:`
    for (const key of values.value.keys()) {
      if (key.startsWith(prefix)) {
        values.value.delete(key)
      }
    }
  }

  function registerWidget(
    nodeId: NodeId,
    name: string,
    type: TWidgetType,
    value: unknown,
    options: Partial<
      Pick<
        WidgetState,
        'label' | 'hidden' | 'disabled' | 'advanced' | 'promoted' | 'serialize'
      >
    > & { widgetOptions?: IWidgetOptions<unknown> } = {}
  ): WidgetState {
    const key = makeKey(nodeId, name)
    const state: WidgetState = {
      nodeId,
      name,
      type,
      value,
      label: options.label,
      hidden: options.hidden ?? false,
      disabled: options.disabled ?? false,
      advanced: options.advanced ?? false,
      promoted: options.promoted ?? false,
      options: options.widgetOptions ?? {},
      serialize: options.serialize ?? true
    }
    widgetStates.value.set(key, state)
    values.value.set(key, value)
    return state
  }

  function unregisterWidget(nodeId: NodeId, widgetName: string): void {
    const key = makeKey(nodeId, widgetName)
    widgetStates.value.delete(key)
    values.value.delete(key)
  }

  function unregisterNode(nodeId: NodeId): void {
    const prefix = `${nodeId}:`
    for (const key of widgetStates.value.keys()) {
      if (key.startsWith(prefix)) {
        widgetStates.value.delete(key)
      }
    }
    removeNode(nodeId)
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
    values,
    widgetStates,
    get,
    set,
    remove,
    removeNode,
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
