import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

export interface WindowRange {
  start: number
  end: number
}

export function mergeWindowRange(
  existing: WindowRange | undefined,
  calculated: WindowRange,
  {
    bufferRows,
    windowSize,
    totalChildren,
    maxWindowSize = windowSize * 2
  }: {
    bufferRows: number
    windowSize: number
    totalChildren: number
    maxWindowSize?: number
  }
): { range: WindowRange; changed: boolean } {
  if (!existing) {
    return { range: calculated, changed: true }
  }

  const updateStart =
    calculated.start < existing.start ||
    (existing.start > 0 && calculated.start > existing.start + bufferRows)
  const updateEnd =
    calculated.end > existing.end ||
    (existing.end < totalChildren && calculated.end < existing.end - bufferRows)

  let start = updateStart ? calculated.start : existing.start
  let end = updateEnd ? calculated.end : existing.end

  if (end - start > maxWindowSize) {
    if (updateStart) {
      end = Math.min(totalChildren, start + maxWindowSize)
    } else {
      start = Math.max(0, end - maxWindowSize)
    }
  }

  const changed =
    updateStart || updateEnd || start !== existing.start || end !== existing.end

  return { range: { start, end }, changed }
}

export function calculateSpacerHeightsVariable<T>(
  items: T[],
  range: WindowRange,
  getHeight: (item: T) => number
): { topSpacer: number; bottomSpacer: number } {
  const topSpacer = items
    .slice(0, range.start)
    .reduce((sum, item) => sum + getHeight(item), 0)

  const bottomSpacer = items
    .slice(range.end)
    .reduce((sum, item) => sum + getHeight(item), 0)

  return { topSpacer, bottomSpacer }
}

export function calculateWindowRangeByHeights<T>({
  items,
  listStart,
  listEnd,
  scrollTop,
  scrollBottom,
  bufferHeight,
  bufferRows,
  windowSize,
  getItemStart,
  getItemHeight
}: {
  items: T[]
  listStart: number
  listEnd: number
  scrollTop: number
  scrollBottom: number
  bufferHeight: number
  bufferRows: number
  windowSize: number
  getItemStart: (item: T) => number
  getItemHeight: (item: T) => number
}): WindowRange {
  const total = items.length
  if (total === 0) return { start: 0, end: 0 }

  const scrollTopWithBuffer = scrollTop - bufferHeight
  const scrollBottomWithBuffer = scrollBottom + bufferHeight

  // Quick checks for lists outside viewport
  if (listEnd < scrollTopWithBuffer) {
    return { start: Math.max(0, total - windowSize), end: total }
  }

  if (listStart > scrollBottomWithBuffer) {
    return { start: 0, end: Math.min(windowSize, total) }
  }

  // Find visible range by iterating items
  let start = 0
  let end = total

  for (let i = 0; i < total; i++) {
    const item = items[i]
    const itemStart = getItemStart(item)
    const itemEnd = itemStart + getItemHeight(item)

    if (itemEnd < scrollTopWithBuffer) start = i + 1
    if (itemStart <= scrollBottomWithBuffer) end = i + 1
  }

  // Apply buffer and ensure minimum window size
  start = Math.max(0, start - bufferRows)
  end = Math.min(total, Math.max(end + bufferRows, start + windowSize))

  return { start, end }
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

  const range =
    windowRanges[node.key] ??
    createInitialWindowRange(node.children.length, windowSize)

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

/**
 * Calculate positions and heights for tree nodes in a single traversal
 * @param root - Root node with children
 * @param options - Configuration options
 * @returns Maps of node positions and heights
 */
export function calculateTreePositionsAndHeights<T extends { key: string }>({
  root,
  itemHeight,
  getChildren,
  isExpanded
}: {
  root: { children?: T[] }
  itemHeight: number
  getChildren: (node: T) => T[] | undefined
  isExpanded: (node: T) => boolean
}): { positions: Map<string, number>; heights: Map<string, number> } {
  const nodePositions = new Map<string, number>()
  const nodeHeights = new Map<string, number>()
  let currentPos = 0

  const traverse = (node: T): number => {
    nodePositions.set(node.key, currentPos)
    currentPos += itemHeight

    let nodeHeight = itemHeight
    const children = getChildren(node)
    if (isExpanded(node) && children) {
      for (const child of children) {
        nodeHeight += traverse(child)
      }
    }

    nodeHeights.set(node.key, nodeHeight)
    return nodeHeight
  }

  root.children?.forEach(traverse)
  return { positions: nodePositions, heights: nodeHeights }
}

/**
 * Calculate list start and end positions for a parent node's children
 * @param node - Parent node
 * @param children - Children array
 * @param nodePositions - Map of node positions
 * @param nodeHeights - Map of node heights
 * @param itemHeight - Height of a single item
 * @returns Object with listStart and listEnd positions
 */
export function calculateChildrenListBounds<T extends { key: string }>({
  node,
  children,
  nodePositions,
  nodeHeights,
  itemHeight
}: {
  node: T
  children: T[]
  nodePositions: Map<string, number>
  nodeHeights: Map<string, number>
  itemHeight: number
}): { listStart: number; listEnd: number } {
  const nodeStart = nodePositions.get(node.key) ?? 0
  const listStart = nodeStart + itemHeight

  if (children.length === 0) {
    return { listStart, listEnd: listStart }
  }

  const lastChild = children.at(-1)!
  const lastChildStart = nodePositions.get(lastChild.key) ?? listStart
  const lastChildHeight = nodeHeights.get(lastChild.key) ?? itemHeight
  const listEnd = lastChildStart + lastChildHeight

  return { listStart, listEnd }
}
