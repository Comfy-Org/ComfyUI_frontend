import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

export function notifyLayoutChanges(canvas: LGraphCanvas): () => void {
  return layoutStore.onChange((change) => {
    if (change.nodeIds.length === 0) return

    for (const nodeId of change.sizeChangedNodeIds) {
      const node = canvas.graph?.getNodeById(nodeId)
      node?.onResize?.(node.size)
    }

    canvas.setDirty(true, true)
  })
}
