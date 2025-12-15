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
export const applyWindow = (
  node: RenderedTreeExplorerNode,
  windowRanges: Record<string, WindowRange>,
  windowSize: number
): RenderedTreeExplorerNode => {
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
 * Shift window forward (load more at end)
 * @param currentRange - Current window range
 * @param totalChildren - Total number of children
 * @param bufferSize - Number of items to shift
 * @param windowSize - Maximum window size
 * @returns New window range, or null if no shift needed
 */
export const shiftWindowForward = (
  currentRange: WindowRange,
  totalChildren: number,
  bufferSize: number,
  windowSize: number
): WindowRange | null => {
  if (currentRange.end >= totalChildren) {
    return null
  }
  const newEnd = Math.min(currentRange.end + bufferSize, totalChildren)
  const newStart = Math.max(0, newEnd - windowSize)
  return { start: newStart, end: newEnd }
}

/**
 * Shift window backward (load more at start)
 * @param currentRange - Current window range
 * @param totalChildren - Total number of children
 * @param bufferSize - Number of items to shift
 * @param windowSize - Maximum window size
 * @returns New window range, or null if no shift needed
 */
export const shiftWindowBackward = (
  currentRange: WindowRange,
  totalChildren: number,
  bufferSize: number,
  windowSize: number
): WindowRange | null => {
  if (currentRange.start <= 0) {
    return null
  }
  const newStart = Math.max(0, currentRange.start - bufferSize)
  const newEnd = Math.min(newStart + windowSize, totalChildren)
  return { start: newStart, end: newEnd }
}

/**
 * Calculate spacer heights for a node's children
 * @param totalChildren - Total number of children
 * @param range - Current window range
 * @param nodeHeight - Height of each node in pixels
 * @returns Top and bottom spacer heights
 */
export const calculateSpacerHeights = (
  totalChildren: number,
  range: WindowRange,
  nodeHeight: number
): { topSpacer: number; bottomSpacer: number } => {
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
export const createInitialWindowRange = (
  totalChildren: number,
  windowSize: number
): WindowRange => ({
  start: 0,
  end: Math.min(windowSize, totalChildren)
})

/**
 * Calculate scroll percentage adjusted for spacer heights
 * @param scrollTop - Current scroll position
 * @param scrollHeight - Total scrollable height
 * @param clientHeight - Visible height
 * @param topSpacerHeight - Combined top spacer height
 * @param bottomSpacerHeight - Combined bottom spacer height
 * @returns Scroll percentage between 0 and 1
 */
export const calculateScrollPercentage = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  topSpacerHeight: number,
  bottomSpacerHeight: number
): number => {
  const realContentHeight = scrollHeight - topSpacerHeight - bottomSpacerHeight
  if (realContentHeight <= 0) return 1
  const adjustedScrollTop = Math.max(0, scrollTop - topSpacerHeight)
  return (adjustedScrollTop + clientHeight) / realContentHeight
}
