/**
 * Greedy Overlap Removal Algorithm for ComfyUI Vue Nodes
 *
 * Strategy:
 * 1. Sort nodes by execution priority (level → x → y)
 * 2. For each overlapping pair, compute minimal movement vector
 * 3. Move only the lower-priority node (preserve higher-priority positions)
 * 4. Iterate until no overlaps remain or max iterations reached
 *
 * This preserves the original layout structure while removing overlaps
 * with minimal total node movement.
 */
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { NodeId, Point } from '@/renderer/core/layout/types'
import { app as comfyApp } from '@/scripts/app'

interface NodeBounds {
  id: NodeId
  x: number
  y: number
  width: number
  height: number
  level: number // Execution order level from Kahn's algorithm
  originalX: number // Store original position for minimal movement
  originalY: number
}

interface OverlapInfo {
  nodeA: NodeBounds
  nodeB: NodeBounds
  overlapX: number // Amount of horizontal overlap
  overlapY: number // Amount of vertical overlap
}

/**
 * Check if two axis-aligned bounding boxes overlap
 */
function boundsOverlap(a: NodeBounds, b: NodeBounds): boolean {
  return !(
    (
      a.x + a.width <= b.x || // A is left of B
      b.x + b.width <= a.x || // B is left of A
      a.y + a.height <= b.y || // A is above B
      b.y + b.height <= a.y
    ) // B is above A
  )
}

/**
 * Calculate overlap amount between two rectangles
 */
function calculateOverlap(a: NodeBounds, b: NodeBounds): OverlapInfo | null {
  if (!boundsOverlap(a, b)) return null

  // Calculate overlap amounts
  const overlapX = Math.min(a.x + a.width - b.x, b.x + b.width - a.x)
  const overlapY = Math.min(a.y + a.height - b.y, b.y + b.height - a.y)

  return {
    nodeA: a,
    nodeB: b,
    overlapX,
    overlapY
  }
}

/**
 * Compute minimal movement vector to separate two overlapping nodes
 * Returns: { dx, dy } - direction and distance to move nodeB away from nodeA
 */
function computeSeparationVector(
  overlap: OverlapInfo,
  margin: number
): { dx: number; dy: number } {
  const { nodeA, nodeB, overlapX, overlapY } = overlap

  // Choose the axis with smaller overlap (requires less movement)
  if (overlapX < overlapY) {
    // Move horizontally
    const direction = nodeB.x < nodeA.x ? -1 : 1
    return {
      dx: direction * (overlapX + margin),
      dy: 0
    }
  } else {
    // Move vertically
    const direction = nodeB.y < nodeA.y ? -1 : 1
    return {
      dx: 0,
      dy: direction * (overlapY + margin)
    }
  }
}

/**
 * Sort nodes by priority for overlap resolution
 * Higher priority = processed first, stays fixed
 * Priority order: level (execution order) → x position → y position
 */
function sortNodesByPriority(nodes: NodeBounds[]): NodeBounds[] {
  return [...nodes].sort((a, b) => {
    // Primary: execution level (earlier in workflow = higher priority)
    if (a.level !== b.level) return a.level - b.level

    // Secondary: x position (left = higher priority)
    if (Math.abs(a.x - b.x) > 10) return a.x - b.x

    // Tertiary: y position (top = higher priority)
    return a.y - b.y
  })
}

/**
 * Detect all overlapping pairs in the current layout
 */
function detectOverlaps(nodes: NodeBounds[]): OverlapInfo[] {
  const overlaps: OverlapInfo[] = []

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const overlap = calculateOverlap(nodes[i], nodes[j])
      if (overlap) {
        overlaps.push(overlap)
      }
    }
  }

  return overlaps
}

/**
 * Resolve a single overlap by moving the lower-priority node
 */
function resolveOverlap(
  overlap: OverlapInfo,
  margin: number,
  priorities: Map<NodeId, number>
): void {
  const { nodeA, nodeB } = overlap

  // Determine which node has lower priority (moves)
  const priorityA = priorities.get(nodeA.id) ?? 0
  const priorityB = priorities.get(nodeB.id) ?? 0

  const separation = computeSeparationVector(overlap, margin)

  if (priorityA < priorityB) {
    // nodeA has higher priority (lower number), move nodeB
    nodeB.x += separation.dx
    nodeB.y += separation.dy
  } else {
    // nodeB has higher priority, move nodeA
    nodeA.x -= separation.dx // Reverse direction
    nodeA.y -= separation.dy
  }
}

/**
 * Main overlap removal algorithm with iterative refinement
 */
function removeAllOverlaps(
  nodes: NodeBounds[],
  options: {
    maxIterations: number
    margin: number
  }
): { converged: boolean; iterations: number } {
  const { maxIterations, margin } = options

  // Build priority map (lower number = higher priority)
  const priorities = new Map<NodeId, number>()
  nodes.forEach((node, index) => {
    priorities.set(node.id, index)
  })

  let previousOverlapCount = Infinity

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const overlaps = detectOverlaps(nodes)

    // Success: no overlaps remaining
    if (overlaps.length === 0) {
      return { converged: true, iterations: iteration }
    }

    // Resolve each overlap
    for (const overlap of overlaps) {
      resolveOverlap(overlap, margin, priorities)
    }

    // Detect stalling (no progress)
    if (overlaps.length === previousOverlapCount && iteration > 5) {
      console.warn(
        `[OverlapRemoval] ⚠ Stalled at ${overlaps.length} overlaps after ${iteration} iterations`
      )
      return { converged: false, iterations: iteration }
    }

    previousOverlapCount = overlaps.length
  }

  console.warn(
    `[OverlapRemoval] ⚠ Did not converge after ${maxIterations} iterations`
  )
  return { converged: false, iterations: maxIterations }
}

/**
 * Snap positions to grid for clean alignment
 */
function snapToGrid(
  positions: Map<NodeId, Point>,
  gridSize: number
): Map<NodeId, Point> {
  const snapped = new Map<NodeId, Point>()

  for (const [nodeId, pos] of positions) {
    snapped.set(nodeId, {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: Math.round(pos.y / gridSize) * gridSize
    })
  }

  return snapped
}

/**
 * Extract node bounds from layout store and graph
 */
function extractNodeBounds(): NodeBounds[] {
  const allNodes = layoutStore.getAllNodes().value
  const graph = comfyApp.canvas?.graph

  if (!graph) {
    console.error('[OverlapRemoval] No graph available')
    return []
  }

  // Compute execution order to get node._level
  graph.computeExecutionOrder(false, true)

  const nodes: NodeBounds[] = []

  for (const [nodeId, layout] of allNodes) {
    // Skip nodes without valid bounds
    if (
      !layout.bounds ||
      layout.bounds.width <= 0 ||
      layout.bounds.height <= 0
    ) {
      continue
    }

    // Get level from graph node
    const graphNode = graph.getNodeById(nodeId)
    const level = graphNode?._level ?? 999 // Unconnected nodes get low priority

    nodes.push({
      id: nodeId,
      x: layout.position.x,
      y: layout.position.y,
      width: layout.size.width,
      height: layout.size.height,
      level,
      originalX: layout.position.x,
      originalY: layout.position.y
    })
  }

  return nodes
}

/**
 * Apply new positions to layout store
 */
function applyNewPositions(
  nodes: NodeBounds[],
  options: { snapToGrid: boolean; gridSize: number }
): void {
  const { moveNode } = useLayoutMutations()
  const { snapToGrid: shouldSnap, gridSize } = options

  // Build position map
  const positions = new Map<NodeId, Point>()
  for (const node of nodes) {
    positions.set(node.id, { x: node.x, y: node.y })
  }

  // Optionally snap to grid
  const finalPositions = shouldSnap
    ? snapToGrid(positions, gridSize)
    : positions

  // Apply movements
  for (const [nodeId, position] of finalPositions) {
    moveNode(nodeId, position)
  }
}

/**
 * Main composable for fixing Vue node overlaps
 */
export function useFixVueNodeOverlap() {
  const fixOverlaps = (options?: {
    maxIterations?: number
    margin?: number
    snapToGrid?: boolean
    gridSize?: number
  }) => {
    const {
      maxIterations = 50,
      margin = 20,
      snapToGrid: shouldSnap = true,
      gridSize = 10
    } = options ?? {}

    // Step 1: Extract node bounds from layout store
    const nodes = extractNodeBounds()

    if (nodes.length === 0) {
      console.warn('[OverlapRemoval] No nodes found')
      return
    }

    // Step 2: Check if any overlaps exist
    const initialOverlaps = detectOverlaps(nodes)
    if (initialOverlaps.length === 0) {
      return
    }

    // Step 3: Sort by priority (execution order)
    const sortedNodes = sortNodesByPriority(nodes)

    // Step 4: Iteratively resolve overlaps
    const result = removeAllOverlaps(sortedNodes, { maxIterations, margin })

    // Step 5: Apply new positions
    applyNewPositions(sortedNodes, {
      snapToGrid: shouldSnap,
      gridSize
    })

    // Step 6: Report convergence
    if (!result.converged) {
      console.warn(
        `[OverlapRemoval] Did not fully converge after ${result.iterations} iterations`
      )
    }
  }

  // Auto-run with default options
  //   fixOverlaps()

  return { fixOverlaps }
}
