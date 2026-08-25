import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'

export function notifyLayoutChanges(canvas: LGraphCanvas): () => void {
  const stopOperations = layoutStore.onChange((change) => {
    const graph = canvas.graph
    if (
      !graph ||
      change.operation.graphId !== graph.rootGraph.id ||
      change.source === LayoutSource.Canvas
    ) {
      return
    }

    for (const nodeId of change.sizeChangedNodeIds) {
      const node = graph.getNodeById(nodeId)
      node?.onResize?.(node.size)
    }
  })
  const stopGeometry = layoutStore.onGeometryChange((graphIds) => {
    const graph = canvas.graph
    if (!graph || !graphIds.has(graph.rootGraph.id)) return

    canvas.setDirty(true, true)
  })

  return () => {
    stopOperations()
    stopGeometry()
  }
}
