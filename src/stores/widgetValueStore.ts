import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type { UUID } from '@/utils/uuid'
import {
  asGraphId,
  isNodeIdForGraph,
  isWidgetIdForGraph,
  nodeEntityId,
  parseWidgetEntityId
} from '@/world/entityIds'
import type { NodeEntityId, WidgetEntityId } from '@/world/entityIds'
import type { WidgetState } from '@/world/widgets/widgetState'

export type { WidgetState } from '@/world/widgets/widgetState'

export const useWidgetValueStore = defineStore('widgetValue', () => {
  const widgets = reactive(new Map<WidgetEntityId, WidgetState>())
  const widgetIdsByNode = reactive(new Map<NodeEntityId, WidgetEntityId[]>())

  function registerWidget<TValue = unknown>(
    widgetId: WidgetEntityId,
    state: WidgetState<TValue>
  ): WidgetState<TValue> {
    const { graphId, nodeId } = parseWidgetEntityId(widgetId)

    widgets.set(widgetId, {
      ...state,
      disabled: state.disabled ?? false
    })

    const ownerId = nodeEntityId(graphId, nodeId)
    const ids = widgetIdsByNode.get(ownerId)
    if (!ids) {
      widgetIdsByNode.set(ownerId, [widgetId])
    } else if (!ids.includes(widgetId)) {
      ids.push(widgetId)
    }

    return widgets.get(widgetId) as WidgetState<TValue>
  }

  function getWidget(widgetId: WidgetEntityId): WidgetState | undefined {
    return widgets.get(widgetId)
  }

  function getNodeWidgets(nodeId: NodeEntityId): WidgetState[] {
    const ids = widgetIdsByNode.get(nodeId)
    if (!ids) return []
    const result: WidgetState[] = []
    for (const widgetId of ids) {
      const w = widgets.get(widgetId)
      if (w) result.push(w)
    }
    return result
  }

  function getNodeWidgetsByName(
    nodeId: NodeEntityId
  ): Map<string, WidgetState> {
    const result = new Map<string, WidgetState>()
    const ids = widgetIdsByNode.get(nodeId)
    if (!ids) return result
    for (const widgetId of ids) {
      const w = widgets.get(widgetId)
      if (!w) continue
      const { name } = parseWidgetEntityId(widgetId)
      result.set(name, w)
    }
    return result
  }

  function setValue(
    widgetId: WidgetEntityId,
    value: WidgetState['value']
  ): boolean {
    const widget = widgets.get(widgetId)
    if (!widget) return false
    widget.value = value
    return true
  }

  function clearGraph(graphId: UUID): void {
    const branded = asGraphId(graphId)
    for (const widgetId of widgets.keys()) {
      if (isWidgetIdForGraph(branded, widgetId)) {
        widgets.delete(widgetId)
      }
    }
    for (const nodeId of widgetIdsByNode.keys()) {
      if (isNodeIdForGraph(branded, nodeId)) {
        widgetIdsByNode.delete(nodeId)
      }
    }
  }

  return {
    registerWidget,
    getWidget,
    setValue,
    getNodeWidgets,
    getNodeWidgetsByName,
    clearGraph
  }
})
