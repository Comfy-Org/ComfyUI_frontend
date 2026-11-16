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
  const nodeHeights = ref(new Map<string, Map<string, number>>())

  function nodeKey(graphId: UUID, nodeId: NodeId) {
    return widgetId(graphId, nodeId, '')
  }

  function splitWidgetId(id: WidgetId) {
    const nameStart = id.lastIndexOf(':') + 1
    return {
      node: id.slice(0, nameStart),
      name: decodeURIComponent(id.slice(nameStart))
    }
  }

  function getHeight(id: WidgetId): number | undefined {
    const { node, name } = splitWidgetId(id)
    return nodeHeights.value.get(node)?.get(name)
  }

  function setHeight(id: WidgetId, height: number | undefined): void {
    const { node, name } = splitWidgetId(id)
    const heights = nodeHeights.value.get(node) ?? new Map<string, number>()
    if (height === undefined) heights.delete(name)
    else heights.set(name, Math.round(height))
    if (heights.size) nodeHeights.value.set(node, heights)
    else nodeHeights.value.delete(node)
  }

  function getNodeHeights(
    graphId: UUID,
    nodeId: NodeId
  ): Record<string, number> | undefined {
    const heights = nodeHeights.value.get(nodeKey(graphId, nodeId))
    return heights?.size ? Object.fromEntries(heights) : undefined
  }

  function clearNode(graphId: UUID, nodeId: NodeId): void {
    nodeHeights.value.delete(nodeKey(graphId, nodeId))
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
    const heights = Object.entries(saved).flatMap(([name, height]) =>
      typeof height === 'number' && height > 0
        ? [[name, Math.round(height)] as const]
        : []
    )
    if (heights.length)
      nodeHeights.value.set(nodeKey(graphId, nodeId), new Map(heights))
  }

  function clearGraph(graphId: UUID): void {
    for (const node of nodeHeights.value.keys())
      if (node.startsWith(`${graphId}:`)) nodeHeights.value.delete(node)
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
