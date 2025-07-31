import type { LGraphNode } from '@comfyorg/litegraph'

/**
 * Filters nodes to find only output nodes.
 * Output nodes are nodes that have the output_node flag set in their nodeData.
 *
 * @param nodes - Array of nodes to filter
 * @returns Array of output nodes only
 */
export function filterOutputNodes(nodes: LGraphNode[]): LGraphNode[] {
  return nodes.filter((node) => node.constructor.nodeData?.output_node)
}

/**
 * Gets selected output nodes from an array of selected nodes.
 * This is a convenience function that combines node filtering with output node detection.
 *
 * @param selectedNodes - Array of selected nodes
 * @returns Array of selected nodes that are output nodes
 */
export function getSelectedOutputNodes(
  selectedNodes: LGraphNode[]
): LGraphNode[] {
  return filterOutputNodes(selectedNodes)
}
