import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'

type WidgetKey = `${NodeId}:${string}`

export const useWidgetValueStore = defineStore('widgetValue', () => {
  const values = ref(new Map<WidgetKey, unknown>())

  function get(nodeId: NodeId, widgetName: string): unknown {
    return values.value.get(`${nodeId}:${widgetName}`)
  }

  function set(nodeId: NodeId, widgetName: string, value: unknown): void {
    values.value.set(`${nodeId}:${widgetName}`, value)
  }

  function remove(nodeId: NodeId, widgetName: string): void {
    values.value.delete(`${nodeId}:${widgetName}`)
  }

  function removeNode(nodeId: NodeId): void {
    const prefix = `${nodeId}:`
    for (const key of values.value.keys()) {
      if (key.startsWith(prefix)) {
        values.value.delete(key)
      }
    }
  }

  return { values, get, set, remove, removeNode }
})
