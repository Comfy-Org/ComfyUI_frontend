/**
 * Composable for spatial indexing of nodes using QuadTree
 * Integrates with useGraphNodeManager for efficient viewport culling
 */
import { useDebounceFn } from '@vueuse/core'
import { computed, reactive, ref } from 'vue'

import { type Bounds, QuadTree } from '@/utils/spatial/QuadTree'

export interface SpatialIndexOptions {
  worldBounds?: Bounds
  maxDepth?: number
  maxItemsPerNode?: number
  enableDebugVisualization?: boolean
  updateDebounceMs?: number
}

interface SpatialMetrics {
  queryTime: number
  totalNodes: number
  visibleNodes: number
  treeDepth: number
  rebuildCount: number
}

export const useSpatialIndex = (options: SpatialIndexOptions = {}) => {
  // Default world bounds (can be expanded dynamically)
  const defaultBounds: Bounds = {
    x: -10000,
    y: -10000,
    width: 20000,
    height: 20000
  }

  // QuadTree instance
  const quadTree = ref<QuadTree<string> | null>(null)

  // Performance metrics
  const metrics = reactive<SpatialMetrics>({
    queryTime: 0,
    totalNodes: 0,
    visibleNodes: 0,
    treeDepth: 0,
    rebuildCount: 0
  })

  // Debug visualization data (unused for now but may be used in future)
  // const debugBounds = ref<Bounds[]>([])

  // Initialize QuadTree
  const initialize = (bounds: Bounds = defaultBounds) => {
    quadTree.value = new QuadTree<string>(bounds, {
      maxDepth: options.maxDepth ?? 6,
      maxItemsPerNode: options.maxItemsPerNode ?? 4
    })
    metrics.rebuildCount++
  }

  // Add or update node in spatial index
  const updateNode = (
    nodeId: string,
    position: { x: number; y: number },
    size: { width: number; height: number }
  ) => {
    if (!quadTree.value) {
      initialize()
    }

    const bounds: Bounds = {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height
    }

    // Use insert instead of update - insert handles both new and existing nodes
    quadTree.value!.insert(nodeId, bounds, nodeId)
    metrics.totalNodes = quadTree.value!.size
  }

  // Batch update for multiple nodes
  const batchUpdate = (
    updates: Array<{
      id: string
      position: { x: number; y: number }
      size: { width: number; height: number }
    }>
  ) => {
    if (!quadTree.value) {
      initialize()
    }

    for (const update of updates) {
      const bounds: Bounds = {
        x: update.position.x,
        y: update.position.y,
        width: update.size.width,
        height: update.size.height
      }
      // Use insert instead of update - insert handles both new and existing nodes
      quadTree.value!.insert(update.id, bounds, update.id)
    }

    metrics.totalNodes = quadTree.value!.size
  }

  // Remove node from spatial index
  const removeNode = (nodeId: string) => {
    if (!quadTree.value) return

    quadTree.value.remove(nodeId)
    metrics.totalNodes = quadTree.value.size
  }

  // Query nodes within viewport bounds
  const queryViewport = (viewportBounds: Bounds): string[] => {
    if (!quadTree.value) return []

    const startTime = performance.now()
    const nodeIds = quadTree.value.query(viewportBounds)
    const queryTime = performance.now() - startTime

    metrics.queryTime = queryTime
    metrics.visibleNodes = nodeIds.length

    return nodeIds
  }

  // Get nodes within a radius (for proximity queries)
  const queryRadius = (
    center: { x: number; y: number },
    radius: number
  ): string[] => {
    if (!quadTree.value) return []

    const bounds: Bounds = {
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2
    }

    return quadTree.value.query(bounds)
  }

  // Clear all nodes
  const clear = () => {
    if (!quadTree.value) return

    quadTree.value.clear()
    metrics.totalNodes = 0
    metrics.visibleNodes = 0
  }

  // Rebuild tree (useful after major layout changes)
  const rebuild = (
    nodes: Map<
      string,
      {
        position: { x: number; y: number }
        size: { width: number; height: number }
      }
    >
  ) => {
    initialize()

    const updates = Array.from(nodes.entries()).map(([id, data]) => ({
      id,
      position: data.position,
      size: data.size
    }))

    batchUpdate(updates)
  }

  // Get debug visualization data
  const getDebugVisualization = () => {
    if (!quadTree.value || !options.enableDebugVisualization) return null

    return quadTree.value.getDebugInfo()
  }

  // Debounced update for performance
  const debouncedUpdateNode = useDebounceFn(
    updateNode,
    options.updateDebounceMs ?? 16
  )

  return {
    // Core functions
    initialize,
    updateNode,
    batchUpdate,
    removeNode,
    queryViewport,
    queryRadius,
    clear,
    rebuild,

    // Debounced version for high-frequency updates
    debouncedUpdateNode,

    // Metrics
    metrics: computed(() => metrics),

    // Debug
    getDebugVisualization,

    // Direct access to QuadTree (for advanced usage)
    quadTree: computed(() => quadTree.value)
  }
}
