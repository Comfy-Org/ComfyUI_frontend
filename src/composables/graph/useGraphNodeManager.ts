/**
 * Vue node lifecycle management for LiteGraph integration
 * Provides event-driven reactivity with performance optimizations
 */
import type { LGraph, LGraphNode } from '@comfyorg/litegraph'
import { nextTick, reactive, readonly } from 'vue'

import { type Bounds, QuadTree } from '../../utils/spatial/QuadTree'

export interface NodeState {
  visible: boolean
  dirty: boolean
  lastUpdate: number
  culled: boolean
}

export interface NodeMetadata {
  lastRenderTime: number
  cachedBounds: DOMRect | null
  lodLevel: 'high' | 'medium' | 'low'
  spatialIndex?: any
}

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  updateTime: number
  nodeCount: number
  culledCount: number
  callbackUpdateCount: number
  rafUpdateCount: number
  adaptiveQuality: boolean
}

export interface SafeWidgetData {
  name: string
  type: string
  value: unknown
  options?: Record<string, unknown>
  callback?: ((value: unknown) => void) | undefined
}

export interface VueNodeData {
  id: string
  title: string
  type: string
  mode: number
  selected: boolean
  executing: boolean
  widgets?: SafeWidgetData[]
  inputs?: unknown[]
  outputs?: unknown[]
}

export interface SpatialMetrics {
  queryTime: number
  nodesInIndex: number
}

export interface GraphNodeManager {
  // Reactive state - safe data extracted from LiteGraph nodes
  vueNodeData: ReadonlyMap<string, VueNodeData>
  nodeState: ReadonlyMap<string, NodeState>
  nodePositions: ReadonlyMap<string, { x: number; y: number }>
  nodeSizes: ReadonlyMap<string, { width: number; height: number }>

  // Access to original LiteGraph nodes (non-reactive)
  getNode(id: string): LGraphNode | undefined

  // Lifecycle methods
  setupEventListeners(): () => void
  cleanup(): void

  // Update methods
  scheduleUpdate(
    nodeId?: string,
    priority?: 'critical' | 'normal' | 'low'
  ): void
  forceSync(): void
  detectChangesInRAF(): void

  // Spatial queries
  getVisibleNodeIds(viewportBounds: Bounds): Set<string>

  // Performance
  performanceMetrics: PerformanceMetrics
  spatialMetrics: SpatialMetrics

  // Debug
  getSpatialIndexDebugInfo(): any | null
}

export const useGraphNodeManager = (graph: LGraph): GraphNodeManager => {
  // Safe reactive data extracted from LiteGraph nodes
  const vueNodeData = reactive(new Map<string, VueNodeData>())
  const nodeState = reactive(new Map<string, NodeState>())
  const nodePositions = reactive(new Map<string, { x: number; y: number }>())
  const nodeSizes = reactive(
    new Map<string, { width: number; height: number }>()
  )

  // Non-reactive storage for original LiteGraph nodes
  const nodeRefs = new Map<string, LGraphNode>()

  // WeakMap for heavy data that auto-GCs when nodes are removed
  const nodeMetadata = new WeakMap<LGraphNode, NodeMetadata>()

  // Performance tracking
  const performanceMetrics = reactive<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    updateTime: 0,
    nodeCount: 0,
    culledCount: 0,
    callbackUpdateCount: 0,
    rafUpdateCount: 0,
    adaptiveQuality: false
  })

  // Spatial indexing using QuadTree
  const spatialIndex = new QuadTree<string>(
    { x: -10000, y: -10000, width: 20000, height: 20000 },
    { maxDepth: 6, maxItemsPerNode: 4 }
  )
  let lastSpatialQueryTime = 0

  // Spatial metrics
  const spatialMetrics = reactive<SpatialMetrics>({
    queryTime: 0,
    nodesInIndex: 0
  })

  // FPS tracking state
  let lastFrameTime = performance.now()
  let frameCount = 0
  let fpsUpdateInterval: number | null = null

  const updateFPS = () => {
    frameCount++
    const now = performance.now()
    const elapsed = now - lastFrameTime

    if (elapsed >= 1000) {
      performanceMetrics.fps = Math.round((frameCount * 1000) / elapsed)
      performanceMetrics.frameTime = elapsed / frameCount
      frameCount = 0
      lastFrameTime = now
    }
  }

  const startFPSTracking = () => {
    if (fpsUpdateInterval) return

    const trackFrame = () => {
      updateFPS()
      fpsUpdateInterval = requestAnimationFrame(trackFrame)
    }
    fpsUpdateInterval = requestAnimationFrame(trackFrame)
  }

  const stopFPSTracking = () => {
    if (fpsUpdateInterval) {
      cancelAnimationFrame(fpsUpdateInterval)
      fpsUpdateInterval = null
    }
  }

  // Update batching
  const pendingUpdates = new Set<string>()
  const criticalUpdates = new Set<string>()
  const lowPriorityUpdates = new Set<string>()
  let updateScheduled = false
  let batchTimeoutId: number | null = null

  // Change detection state
  const lastNodesSnapshot = new Map<
    string,
    { pos: [number, number]; size: [number, number] }
  >()

  const attachMetadata = (node: LGraphNode) => {
    nodeMetadata.set(node, {
      lastRenderTime: performance.now(),
      cachedBounds: null,
      lodLevel: 'high',
      spatialIndex: undefined
    })
  }

  // Extract safe data from LiteGraph node for Vue consumption
  const extractVueNodeData = (node: LGraphNode): VueNodeData => {
    // Extract safe widget data
    const safeWidgets = node.widgets?.map((widget) => {
      try {
        // TODO: Use widget.getReactiveData() once TypeScript types are updated
        let value = widget.value

        // For combo widgets, if value is undefined, use the first option as default
        if (
          value === undefined &&
          widget.type === 'combo' &&
          widget.options?.values &&
          Array.isArray(widget.options.values) &&
          widget.options.values.length > 0
        ) {
          value = widget.options.values[0]
        }

        return {
          name: widget.name,
          type: widget.type,
          value: value,
          options: widget.options ? { ...widget.options } : undefined,
          callback: widget.callback
        }
      } catch (error) {
        return {
          name: widget.name || 'unknown',
          type: widget.type || 'text',
          value: undefined,
          options: undefined,
          callback: undefined
        }
      }
    })

    return {
      id: String(node.id),
      title: node.title || 'Untitled',
      type: node.type || 'Unknown',
      mode: node.mode || 0,
      selected: node.selected || false,
      executing: false, // Will be updated separately based on execution state
      widgets: safeWidgets,
      inputs: node.inputs ? [...node.inputs] : undefined,
      outputs: node.outputs ? [...node.outputs] : undefined
    }
  }

  // Get access to original LiteGraph node (non-reactive)
  const getNode = (id: string): LGraphNode | undefined => {
    return nodeRefs.get(id)
  }

  const setupNodeWidgetCallbacks = (node: LGraphNode) => {
    const nodeId = String(node.id)

    node.widgets?.forEach((widget) => {
      // Create a new callback that updates the widget value AND the Vue state
      const originalCallback = widget.callback
      widget.callback = (value: unknown) => {
        // 1. Update the widget value in LiteGraph
        // Widget value can be various types, cast appropriately
        widget.value = value as string | number | boolean | object | undefined

        // 2. Call the original callback if it exists
        if (originalCallback) {
          originalCallback.call(widget, value)
        }

        // 3. Update Vue state
        try {
          const currentData = vueNodeData.get(nodeId)
          if (currentData?.widgets) {
            const updatedWidgets = currentData.widgets.map((w) =>
              w.name === widget.name ? { ...w, value: value } : w
            )
            vueNodeData.set(nodeId, {
              ...currentData,
              widgets: updatedWidgets
            })
          }
          performanceMetrics.callbackUpdateCount++
        } catch (error) {
          // Ignore widget update errors to prevent cascade failures
        }
      }
    })
  }

  // Uncomment when needed for future features
  // const getNodeMetadata = (node: LGraphNode): NodeMetadata => {
  //   let metadata = nodeMetadata.get(node)
  //   if (!metadata) {
  //     attachMetadata(node)
  //     metadata = nodeMetadata.get(node)!
  //   }
  //   return metadata
  // }

  const scheduleUpdate = (
    nodeId?: string,
    priority: 'critical' | 'normal' | 'low' = 'normal'
  ) => {
    if (nodeId) {
      const state = nodeState.get(nodeId)
      if (state) state.dirty = true

      // Priority queuing
      if (priority === 'critical') {
        criticalUpdates.add(nodeId)
        flush() // Immediate flush for critical updates
        return
      } else if (priority === 'low') {
        lowPriorityUpdates.add(nodeId)
      } else {
        pendingUpdates.add(nodeId)
      }
    }

    if (!updateScheduled) {
      updateScheduled = true

      // Adaptive batching strategy
      if (pendingUpdates.size > 10) {
        // Many updates - batch in nextTick
        void nextTick(() => flush())
      } else {
        // Few updates - small delay for more batching
        batchTimeoutId = window.setTimeout(() => flush(), 4)
      }
    }
  }

  const flush = () => {
    const startTime = performance.now()

    if (batchTimeoutId !== null) {
      clearTimeout(batchTimeoutId)
      batchTimeoutId = null
    }

    // Clear all pending updates
    criticalUpdates.clear()
    pendingUpdates.clear()
    lowPriorityUpdates.clear()
    updateScheduled = false

    // Sync with graph state
    syncWithGraph()

    const endTime = performance.now()
    performanceMetrics.updateTime = endTime - startTime
  }

  const syncWithGraph = () => {
    if (!graph?._nodes) return

    const currentNodes = new Set(graph._nodes.map((n) => String(n.id)))

    // Remove deleted nodes
    for (const id of Array.from(vueNodeData.keys())) {
      if (!currentNodes.has(id)) {
        nodeRefs.delete(id)
        vueNodeData.delete(id)
        nodeState.delete(id)
        nodePositions.delete(id)
        nodeSizes.delete(id)
        lastNodesSnapshot.delete(id)
        spatialIndex.remove(id)
      }
    }

    // Add/update existing nodes
    graph._nodes.forEach((node) => {
      const id = String(node.id)

      // Store non-reactive reference
      nodeRefs.set(id, node)

      // Extract and store safe data for Vue
      vueNodeData.set(id, extractVueNodeData(node))

      if (!nodeState.has(id)) {
        nodeState.set(id, {
          visible: true,
          dirty: false,
          lastUpdate: performance.now(),
          culled: false
        })
        nodePositions.set(id, { x: node.pos[0], y: node.pos[1] })
        nodeSizes.set(id, { width: node.size[0], height: node.size[1] })
        attachMetadata(node)

        // Add to spatial index
        const bounds: Bounds = {
          x: node.pos[0],
          y: node.pos[1],
          width: node.size[0],
          height: node.size[1]
        }
        spatialIndex.insert(id, bounds, id)
      }
    })

    // Update performance metrics
    performanceMetrics.nodeCount = vueNodeData.size
    performanceMetrics.culledCount = Array.from(nodeState.values()).filter(
      (s) => s.culled
    ).length
  }

  // Most performant: Direct position sync without re-setting entire node
  // Query visible nodes using QuadTree spatial index
  const getVisibleNodeIds = (viewportBounds: Bounds): Set<string> => {
    const startTime = performance.now()

    // Use QuadTree for fast spatial query
    const results: string[] = spatialIndex.query(viewportBounds)
    const visibleIds = new Set(results)

    lastSpatialQueryTime = performance.now() - startTime
    spatialMetrics.queryTime = lastSpatialQueryTime

    return visibleIds
  }

  const detectChangesInRAF = () => {
    const startTime = performance.now()

    if (!graph?._nodes) return

    let positionUpdates = 0
    let sizeUpdates = 0

    // Update reactive positions and sizes
    for (const node of graph._nodes) {
      const id = String(node.id)
      const currentPos = nodePositions.get(id)
      const currentSize = nodeSizes.get(id)

      let posChanged = false
      let sizeChanged = false

      if (
        !currentPos ||
        currentPos.x !== node.pos[0] ||
        currentPos.y !== node.pos[1]
      ) {
        nodePositions.set(id, { x: node.pos[0], y: node.pos[1] })
        positionUpdates++
        posChanged = true
      }

      if (
        !currentSize ||
        currentSize.width !== node.size[0] ||
        currentSize.height !== node.size[1]
      ) {
        nodeSizes.set(id, { width: node.size[0], height: node.size[1] })
        sizeUpdates++
        sizeChanged = true
      }

      // Update spatial index if position/size changed
      if (posChanged || sizeChanged) {
        const bounds: Bounds = {
          x: node.pos[0],
          y: node.pos[1],
          width: node.size[0],
          height: node.size[1]
        }
        spatialIndex.update(id, bounds)
      }
    }

    // Update performance metrics
    const endTime = performance.now()
    performanceMetrics.updateTime = endTime - startTime
    performanceMetrics.nodeCount = vueNodeData.size
    performanceMetrics.culledCount = Array.from(nodeState.values()).filter(
      (state) => state.culled
    ).length
    spatialMetrics.nodesInIndex = spatialIndex.size

    if (positionUpdates > 0 || sizeUpdates > 0) {
      performanceMetrics.rafUpdateCount++
    }
  }

  const setupEventListeners = (): (() => void) => {
    // Store original callbacks
    const originalOnNodeAdded = graph.onNodeAdded
    const originalOnNodeRemoved = graph.onNodeRemoved

    // Override callbacks
    graph.onNodeAdded = (node: LGraphNode) => {
      const id = String(node.id)

      // Store non-reactive reference to original node
      nodeRefs.set(id, node)

      // Set up widget callbacks BEFORE extracting data
      setupNodeWidgetCallbacks(node)

      // Extract safe data for Vue (now with proper callbacks)
      vueNodeData.set(id, extractVueNodeData(node))

      // Set up reactive tracking
      nodeState.set(id, {
        visible: true,
        dirty: false,
        lastUpdate: performance.now(),
        culled: false
      })
      nodePositions.set(id, { x: node.pos[0], y: node.pos[1] })
      nodeSizes.set(id, { width: node.size[0], height: node.size[1] })
      attachMetadata(node)

      // Add to spatial index
      const bounds: Bounds = {
        x: node.pos[0],
        y: node.pos[1],
        width: node.size[0],
        height: node.size[1]
      }
      spatialIndex.insert(id, bounds, id)

      if (originalOnNodeAdded) {
        void originalOnNodeAdded(node)
      }
    }

    graph.onNodeRemoved = (node: LGraphNode) => {
      const id = String(node.id)

      // Remove from spatial index
      spatialIndex.remove(id)

      nodeRefs.delete(id)
      vueNodeData.delete(id)
      nodeState.delete(id)
      nodePositions.delete(id)
      nodeSizes.delete(id)
      lastNodesSnapshot.delete(id)
      originalOnNodeRemoved?.(node)
    }

    // Initial sync
    syncWithGraph()

    // Start FPS tracking
    startFPSTracking()

    // Return cleanup function
    return () => {
      // Restore original callbacks
      graph.onNodeAdded = originalOnNodeAdded
      graph.onNodeRemoved = originalOnNodeRemoved

      // Clear pending updates
      if (batchTimeoutId !== null) {
        clearTimeout(batchTimeoutId)
        batchTimeoutId = null
      }

      // Stop FPS tracking
      stopFPSTracking()

      // Clear state
      nodeRefs.clear()
      vueNodeData.clear()
      nodeState.clear()
      nodePositions.clear()
      nodeSizes.clear()
      lastNodesSnapshot.clear()
      pendingUpdates.clear()
      criticalUpdates.clear()
      lowPriorityUpdates.clear()
      spatialIndex.clear()
    }
  }

  // Set up event listeners immediately
  const cleanup = setupEventListeners()

  // Process any existing nodes after event listeners are set up
  if (graph._nodes && graph._nodes.length > 0) {
    graph._nodes.forEach((node: LGraphNode) => {
      if (graph.onNodeAdded) {
        graph.onNodeAdded(node)
      }
    })
  }

  return {
    vueNodeData: readonly(vueNodeData) as ReadonlyMap<string, VueNodeData>,
    nodeState: readonly(nodeState) as ReadonlyMap<string, NodeState>,
    nodePositions: readonly(nodePositions) as ReadonlyMap<
      string,
      { x: number; y: number }
    >,
    nodeSizes: readonly(nodeSizes) as ReadonlyMap<
      string,
      { width: number; height: number }
    >,
    getNode,
    setupEventListeners,
    cleanup,
    scheduleUpdate,
    forceSync: syncWithGraph,
    detectChangesInRAF,
    getVisibleNodeIds,
    performanceMetrics,
    spatialMetrics: readonly(spatialMetrics),
    getSpatialIndexDebugInfo: () => spatialIndex.getDebugInfo()
  }
}
