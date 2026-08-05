import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'

export function notifyLayoutChanges(canvas: LGraphCanvas): () => void {
  return layoutStore.onChange((change) => {
    const graph = canvas.graph
    if (
      !graph ||
      change.operation.graphId !== graph.rootGraph.id ||
      change.nodeIds.length === 0
    ) {
      return
    }

    if (change.source !== LayoutSource.Canvas) {
      for (const nodeId of change.sizeChangedNodeIds) {
        const node = graph.getNodeById(nodeId)
        node?.onResize?.(node.size)
      }
    }

    canvas.setDirty(true, true)
  })
}
