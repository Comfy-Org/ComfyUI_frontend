import { defineStore } from 'pinia'
import { isPlainObject } from 'es-toolkit'
import { ref } from 'vue'

import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { parseWidgetId } from '@comfyorg/graph-model/widgetId'
import type { UUID } from '@/utils/uuid'

/** User-sized heights of Vue node widgets and previews, keyed by {@link WidgetId} and saved in a node's `widgetHeights` property. */
export const useWidgetHeightStore = defineStore('widgetHeight', () => {
  const graphHeights = ref(new Map<UUID, Map<string, Map<string, number>>>())

  function nodeHeightsOf(graphId: UUID, nodeId: NodeId) {
    return graphHeights.value.get(graphId)?.get(String(nodeId))
  }

  function setNodeHeights(
    graphId: UUID,
    nodeId: NodeId,
    heights: Map<string, number>
  ) {
    const nodes = graphHeights.value.get(graphId) ?? new Map()
    if (heights.size) nodes.set(String(nodeId), heights)
    else nodes.delete(String(nodeId))
    if (nodes.size) graphHeights.value.set(graphId, nodes)
    else graphHeights.value.delete(graphId)
  }

  function getHeight(id: WidgetId): number | undefined {
    const { graphId, nodeId, name } = parseWidgetId(id)
    return nodeHeightsOf(graphId, nodeId)?.get(name)
  }

  function setHeight(id: WidgetId, height: number | undefined): void {
    const { graphId, nodeId, name } = parseWidgetId(id)
    const heights = new Map(nodeHeightsOf(graphId, nodeId))
    if (height === undefined) heights.delete(name)
    else heights.set(name, Math.round(height))
    setNodeHeights(graphId, nodeId, heights)
  }

  function getNodeHeights(
    graphId: UUID,
    nodeId: NodeId
  ): Record<string, number> | undefined {
    const heights = nodeHeightsOf(graphId, nodeId)
    return heights?.size ? Object.fromEntries(heights) : undefined
  }

  function clearNode(graphId: UUID, nodeId: NodeId): void {
    setNodeHeights(graphId, nodeId, new Map())
  }

  function adoptNodeHeights(
    graphId: UUID,
    nodeId: NodeId,
    properties: Record<string, NodeProperty | undefined>
  ): void {
    const saved = properties.widgetHeights
    delete properties.widgetHeights
    const heights = isPlainObject(saved)
      ? Object.entries(saved).flatMap(([name, height]) =>
          typeof height === 'number' && height > 0
            ? [[name, Math.round(height)] as const]
            : []
        )
      : []
    setNodeHeights(graphId, nodeId, new Map(heights))
  }

  function clearGraph(graphId: UUID): void {
    graphHeights.value.delete(graphId)
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
