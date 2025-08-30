/**
 * Node Change Detection
 *
 * RAF-based change detection for node positions and sizes.
 * Syncs LiteGraph changes to the layout system.
 */
import { reactive } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutMutations } from '@/renderer/core/layout/operations/LayoutMutations'

export interface ChangeDetectionMetrics {
  updateTime: number
  positionUpdates: number
  sizeUpdates: number
  rafUpdateCount: number
}

/**
 * Change detection for node geometry
 */
export function useNodeChangeDetection(graph: LGraph) {
  const metrics = reactive<ChangeDetectionMetrics>({
    updateTime: 0,
    positionUpdates: 0,
    sizeUpdates: 0,
    rafUpdateCount: 0
  })

  // Track last known positions/sizes
  const lastSnapshot = new Map<
    string,
    { pos: [number, number]; size: [number, number] }
  >()

  /**
   * Detects position changes for a single node
   */
  const detectPositionChanges = (
    node: LGraphNode,
    nodePositions: Map<string, { x: number; y: number }>
  ): boolean => {
    const id = String(node.id)
    const currentPos = nodePositions.get(id)

    if (
      !currentPos ||
      currentPos.x !== node.pos[0] ||
      currentPos.y !== node.pos[1]
    ) {
      nodePositions.set(id, { x: node.pos[0], y: node.pos[1] })

      // Push position change to layout store
      void layoutMutations.moveNode(id, { x: node.pos[0], y: node.pos[1] })

      return true
    }
    return false
  }

  /**
   * Detects size changes for a single node
   */
  const detectSizeChanges = (
    node: LGraphNode,
    nodeSizes: Map<string, { width: number; height: number }>
  ): boolean => {
    const id = String(node.id)
    const currentSize = nodeSizes.get(id)

    if (
      !currentSize ||
      currentSize.width !== node.size[0] ||
      currentSize.height !== node.size[1]
    ) {
      nodeSizes.set(id, { width: node.size[0], height: node.size[1] })

      // Push size change to layout store
      void layoutMutations.resizeNode(id, {
        width: node.size[0],
        height: node.size[1]
      })

      return true
    }
    return false
  }

  /**
   * Main RAF change detection function
   */
  const detectChanges = (
    nodePositions: Map<string, { x: number; y: number }>,
    nodeSizes: Map<string, { width: number; height: number }>,
    onSpatialChange?: (node: LGraphNode, id: string) => void
  ) => {
    const startTime = performance.now()

    if (!graph?._nodes) return

    let positionUpdates = 0
    let sizeUpdates = 0

    // Set source for all canvas-driven updates
    layoutMutations.setSource('canvas')

    // Process each node for changes
    for (const node of graph._nodes) {
      const id = String(node.id)

      const posChanged = detectPositionChanges(node, nodePositions)
      const sizeChanged = detectSizeChanges(node, nodeSizes)

      if (posChanged) positionUpdates++
      if (sizeChanged) sizeUpdates++

      // Notify spatial change if needed
      if ((posChanged || sizeChanged) && onSpatialChange) {
        onSpatialChange(node, id)
      }
    }

    // Update metrics
    const endTime = performance.now()
    metrics.updateTime = endTime - startTime
    metrics.positionUpdates = positionUpdates
    metrics.sizeUpdates = sizeUpdates

    if (positionUpdates > 0 || sizeUpdates > 0) {
      metrics.rafUpdateCount++
    }
  }

  /**
   * Take a snapshot of current node positions/sizes
   */
  const takeSnapshot = () => {
    if (!graph?._nodes) return

    lastSnapshot.clear()
    for (const node of graph._nodes) {
      lastSnapshot.set(String(node.id), {
        pos: [node.pos[0], node.pos[1]],
        size: [node.size[0], node.size[1]]
      })
    }
  }

  /**
   * Check if any nodes have changed since last snapshot
   */
  const hasChangedSinceSnapshot = (): boolean => {
    if (!graph?._nodes) return false

    for (const node of graph._nodes) {
      const id = String(node.id)
      const last = lastSnapshot.get(id)
      if (!last) continue

      if (
        last.pos[0] !== node.pos[0] ||
        last.pos[1] !== node.pos[1] ||
        last.size[0] !== node.size[0] ||
        last.size[1] !== node.size[1]
      ) {
        return true
      }
    }
    return false
  }

  return {
    metrics,
    detectChanges,
    detectPositionChanges,
    detectSizeChanges,
    takeSnapshot,
    hasChangedSinceSnapshot
  }
}
