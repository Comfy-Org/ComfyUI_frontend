import { defineStore } from 'pinia'
import { isPlainObject } from 'es-toolkit'
import { ref } from 'vue'

import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { UUID } from '@/utils/uuid'

/** User-sized heights of Vue node widgets and previews, keyed by {@link WidgetId} and saved in a node's `widgetHeights` property. */
export const useWidgetHeightStore = defineStore('widgetHeight', () => {
  const heights = ref(new Map<WidgetId, number>())

  function nodeEntries(graphId: UUID, nodeId: NodeId) {
    const prefix = widgetId(graphId, nodeId, '')
    return [...heights.value].flatMap(([id, height]) =>
      id.startsWith(prefix)
        ? [[decodeURIComponent(id.slice(prefix.length)), height] as const]
        : []
    )
  }

  function getHeight(id: WidgetId): number | undefined {
    return heights.value.get(id)
  }

  function setHeight(id: WidgetId, height: number | undefined): void {
    if (height === undefined) heights.value.delete(id)
    else heights.value.set(id, Math.round(height))
  }

  function getNodeHeights(
    graphId: UUID,
    nodeId: NodeId
  ): Record<string, number> | undefined {
    const entries = nodeEntries(graphId, nodeId)
    if (!entries.length) return undefined
    return Object.fromEntries(entries)
  }

  function clearNode(graphId: UUID, nodeId: NodeId): void {
    for (const [name] of nodeEntries(graphId, nodeId))
      heights.value.delete(widgetId(graphId, nodeId, name))
  }

  function adoptNodeHeights(
    graphId: UUID,
    nodeId: NodeId,
    properties: Record<string, NodeProperty | undefined>
  ): void {
    const saved = properties.widgetHeights
    delete properties.widgetHeights
    clearNode(graphId, nodeId)
    if (!isPlainObject(saved)) return
    for (const [name, height] of Object.entries(saved))
      if (typeof height === 'number' && height > 0)
        setHeight(widgetId(graphId, nodeId, name), height)
  }

  function clearGraph(graphId: UUID): void {
    for (const id of heights.value.keys())
      if (id.startsWith(`${graphId}:`)) heights.value.delete(id)
  }

  return {
    getHeight,
    setHeight,
    getNodeHeights,
    adoptNodeHeights,
    clearNode,
    clearGraph
  }
})
