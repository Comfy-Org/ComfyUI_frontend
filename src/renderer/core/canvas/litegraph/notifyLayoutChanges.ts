import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

/**
 * Tells the legacy canvas about geometry the store changed on its own — a Vue
 * drag, a DOM size measurement — which it would otherwise never repaint for.
 *
 * Node geometry itself needs no forwarding: `pos` and `size` project from the
 * store, so they are already current. What does not carry across is
 * `onResize`, which extensions such as `useLoad3d` and DOM widgets chain onto.
 * `LGraphNode.setSize` fires it for resizes the class initiates; this covers
 * the ones the store initiates.
 *
 * It fires on the operation rather than on a class/store size difference:
 * there is no longer any difference to detect, so a diff-based check would sit
 * silently inert.
 *
 * @param canvas The canvas to repaint and whose nodes should be notified
 * @returns A function that stops the notifications
 */
export function notifyLayoutChanges(canvas: LGraphCanvas): () => void {
  return layoutStore.onChange((change) => {
    if (change.nodeIds.length === 0) return

    const { type } = change.operation
    if (type === 'resizeNode' || type === 'batchUpdateBounds') {
      for (const nodeId of change.nodeIds) {
        const node = canvas.graph?.getNodeById(nodeId)
        node?.onResize?.(node.size)
      }
    }

    canvas.setDirty(true, true)
  })
}
