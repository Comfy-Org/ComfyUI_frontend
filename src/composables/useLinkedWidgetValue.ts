import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

/**
 * Returns the upstream widget value for a connected input slot.
 * Matches by output slot name first, then falls back to widget type.
 */
export function useLinkedWidgetValue(
  nodeId: string,
  widgetName: string,
  widgetType: string
): ComputedRef<unknown | undefined> {
  const canvasStore = useCanvasStore()
  const widgetValueStore = useWidgetValueStore()

  return computed(() => {
    const graph = canvasStore.canvas?.graph
    if (!graph) return undefined

    const node = graph.getNodeById(nodeId)
    if (!node?.inputs) return undefined

    const slot = node.inputs.find((s) => s.name === widgetName)
    if (!slot?.link) return undefined

    const link = graph.getLink(slot.link)
    if (!link) return undefined

    const graphId = graph.rootGraph.id
    const originNode = graph.getNodeById(link.origin_id)
    const outputName = originNode?.outputs?.[link.origin_slot]?.name

    const upstreamWidgets = widgetValueStore.getNodeWidgets(
      graphId,
      link.origin_id
    )

    const matched = outputName
      ? upstreamWidgets.find((w) => w.name === outputName)
      : undefined

    if (matched) return matched.value

    const typeMatches = upstreamWidgets.filter((w) => w.type === widgetType)
    return typeMatches.length === 1 ? typeMatches[0].value : undefined
  })
}
