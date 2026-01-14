import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LGraphEventMode } from '@/lib/litegraph/src/litegraph'

/**
 * Composable for managing node execution modes.
 * Provides a centralized way to change node modes while ensuring
 * proper graph state updates and side effects.
 */
export function useNodeMode() {
  /**
   * Sets the execution mode for a single node.
   * Uses the node's changeMode method to handle mode-specific side effects
   * and notifies the graph of the change.
   */
  function setNodeMode(node: LGraphNode, mode: LGraphEventMode): void {
    node.changeMode(mode)
    node.graph?.change()
  }

  /**
   * Sets the execution mode for multiple nodes.
   * Applies the mode to all nodes and notifies the graph once.
   */
  function setNodesMode(nodes: LGraphNode[], mode: LGraphEventMode): void {
    if (nodes.length === 0) return

    nodes.forEach((node) => {
      node.changeMode(mode)
    })

    // Only call change once for all nodes
    nodes[0].graph?.change()
  }

  return {
    setNodeMode,
    setNodesMode
  }
}
