import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

export interface WindowRange {
  start: number
  end: number
}

/**
 * Apply a sliding window to limit visible children of a node
 * @param node - The node to apply the window to
 * @param windowRanges - Map of node keys to their window ranges
 * @param windowSize - Maximum number of items in the window
 * @returns The node with windowed children
 */
export function applyWindow(
  node: RenderedTreeExplorerNode,
  windowRanges: Record<string, WindowRange>,
  windowSize: number
): RenderedTreeExplorerNode {
  if (!node.children || node.leaf || node.children.length === 0) {
    return node
  }

  const totalChildren = node.children.length
  const range = windowRanges[node.key] ?? {
    start: 0,
    end: Math.min(windowSize, totalChildren)
  }

  // Recursively apply window to children
  const windowedChildren = node.children
    .slice(range.start, range.end)
    .map((child) => applyWindow(child, windowRanges, windowSize))

  return {
    ...node,
    children: windowedChildren
  }
}

/**
 * Calculate spacer heights for a node's children
 * @param totalChildren - Total number of children
 * @param range - Current window range
 * @param nodeHeight - Height of each node in pixels
 * @returns Top and bottom spacer heights
 */
export function calculateSpacerHeights(
  totalChildren: number,
  range: WindowRange,
  nodeHeight: number
): { topSpacer: number; bottomSpacer: number } {
  const topSpacer = range.start * nodeHeight
  const bottomSpacer = Math.max(0, totalChildren - range.end) * nodeHeight
  return { topSpacer, bottomSpacer }
}

/**
 * Create initial window range for a node
 * @param totalChildren - Total number of children
 * @param windowSize - Maximum window size
 * @returns Initial window range starting from 0
 */
export function createInitialWindowRange(
  totalChildren: number,
  windowSize: number
): WindowRange {
  return {
    start: 0,
    end: Math.min(windowSize, totalChildren)
  }
}
