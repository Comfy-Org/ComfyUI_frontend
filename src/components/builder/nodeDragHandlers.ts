import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

/** The node's drag-and-drop methods, bound to call them on the node itself. */
export function nodeDragHandlers(node: LGraphNode) {
  return {
    onDragOver:
      node.onDragOver && ((e: DragEvent) => node.onDragOver?.(e) ?? false),
    onDragDrop:
      node.onDragDrop && ((e: DragEvent) => node.onDragDrop?.(e) ?? false)
  }
}
