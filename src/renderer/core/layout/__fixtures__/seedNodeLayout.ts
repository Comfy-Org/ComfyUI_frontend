import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import type { NodeId } from '@/types/nodeId'

/**
 * Creates a node's layout entry without a graph. Production registers nodes in
 * `LGraph.add`; tests that exercise the store on its own need the entry to
 * exist without standing up a graph to hold it.
 */
export function seedNodeLayout(
  nodeId: NodeId,
  [x, y]: [number, number],
  [width, height]: [number, number],
  zIndex = 0
): void {
  useLayoutMutations().createNode(nodeId, {
    position: { x, y },
    size: { width, height },
    zIndex,
    visible: true
  })
}
