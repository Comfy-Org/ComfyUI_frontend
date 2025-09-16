/**
 * Vue node lifecycle management for LiteGraph integration
 * Provides event-driven reactivity with performance optimizations
 */
import { nextTick, reactive } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import { type Bounds, QuadTree } from '@/renderer/core/spatial/QuadTree'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useWidgetSpec } from '@/services/widgetSpecificationService'
import type { WidgetValue } from '@/types/simplifiedWidget'
import type { SpatialIndexDebugInfo } from '@/types/spatialIndex'

import type { LGraph, LGraphNode } from '../../lib/litegraph/src/litegraph'

export interface NodeState {
  visible: boolean
  dirty: boolean
  lastUpdate: number
  culled: boolean
}

interface NodeMetadata {
  lastRenderTime: number
  cachedBounds: DOMRect | null
  lodLevel: 'high' | 'medium' | 'low'
  spatialIndex?: QuadTree<string>
}

interface PerformanceMetrics {
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
  value: WidgetValue
  options?: Record<string, unknown>
  callback?: ((value: unknown) => void) | undefined
  /** Input specification for this widget */
  spec?: InputSpecV2
}

export interface VueNodeData {
  id: string
  title: string
  type: string
  mode: number
  selected: boolean
  executing: boolean
  subgraphId?: string | null
  widgets?: SafeWidgetData[]
  inputs?: unknown[]
  outputs?: unknown[]
  hasErrors?: boolean
  flags?: {
    collapsed?: boolean
  }
}

interface SpatialMetrics {
  queryTime: number
  nodesInIndex: number
}

interface GraphNodeManager {
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
  getSpatialIndexDebugInfo(): SpatialIndexDebugInfo | null
}

export const useGraphNodeManager = (graph: LGraph): GraphNodeManager => {
  // Get layout mutations composable
  const { moveNode, resizeNode, createNode, deleteNode, setSource } =
    useLayoutMutations()

  // Get widget specification service
  const widgetSpec = useWidgetSpec()
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
    // Determine subgraph ID - null for root graph, string for subgraphs
    const subgraphId =
      node.graph && 'id' in node.graph && node.graph !== node.graph.rootGraph
        ? String(node.graph.id)
        : null
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

        // Get input spec - no manual mapping needed
        const spec = widgetSpec.getInputSpec(node, widget.name)

        return {
          name: widget.name,
          type: widget.type,
          value: value,
          options: widget.options ? { ...widget.options } : undefined,
          callback: widget.callback,
          spec
        }
      } catch (error) {
        return {
          name: widget.name || 'unknown',
          type: widget.type || 'text',
          value: undefined, // Already a valid WidgetValue
          options: undefined,
          callback: undefined,
          spec: undefined
        }
      }
    })

    const nodeType =
      node.type ||
      node.constructor?.comfyClass ||
      node.constructor?.title ||
      node.constructor?.name ||
      'Unknown'

    return {
      id: String(node.id),
      title: typeof node.title === 'string' ? node.title : '',
      type: nodeType,
      mode: node.mode || 0,
      selected: node.selected || false,
      executing: false, // Will be updated separately based on execution state
      subgraphId,
      hasErrors: !!node.has_errors,
      widgets: safeWidgets,
      inputs: node.inputs ? [...node.inputs] : undefined,
      outputs: node.outputs ? [...node.outputs] : undefined,
      flags: node.flags ? { ...node.flags } : undefined
    }
  }

  // Get access to original LiteGraph node (non-reactive)
  const getNode = (id: string): LGraphNode | undefined => {
    return nodeRefs.get(id)
  }

  /**
   * Validates that a value is a valid WidgetValue type
   */
  const validateWidgetValue = (value: unknown): WidgetValue => {
    if (value === null || value === undefined || value === void 0) {
      return undefined
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value
    }
    if (typeof value === 'object') {
      // Check if it's a File array
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((item): item is File => item instanceof File)
      ) {
        return value
      }
      // Otherwise it's a generic object
      return value
    }
    // If none of the above, return undefined
    console.warn(`Invalid widget value type: ${typeof value}`, value)
    return undefined
  }

  /**
   * Updates Vue state when widget values change
   */
  const updateVueWidgetState = (
    nodeId: string,
    widgetName: string,
    value: unknown
  ): void => {
    try {
      const currentData = vueNodeData.get(nodeId)
      if (!currentData?.widgets) return

      const updatedWidgets = currentData.widgets.map((w) =>
        w.name === widgetName ? { ...w, value: validateWidgetValue(value) } : w
      )
      vueNodeData.set(nodeId, {
        ...currentData,
        widgets: updatedWidgets
      })
      performanceMetrics.callbackUpdateCount++
    } catch (error) {
      // Ignore widget update errors to prevent cascade failures
    }
  }

  /**
   * Creates a wrapped callback for a widget that maintains LiteGraph/Vue sync
   */
  const createWrappedWidgetCallback = (
    widget: { value?: unknown; name: string }, // LiteGraph widget with minimal typing
    originalCallback: ((value: unknown) => void) | undefined,
    nodeId: string
  ) => {
    let updateInProgress = false

    return (value: unknown) => {
      if (updateInProgress) return
      updateInProgress = true

      try {
        // 1. Update the widget value in LiteGraph (critical for LiteGraph state)
        // Validate that the value is of an acceptable type
        if (
          value !== null &&
          value !== undefined &&
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean' &&
          typeof value !== 'object'
        ) {
          console.warn(`Invalid widget value type: ${typeof value}`)
          updateInProgress = false
          return
        }

        // Always update widget.value to ensure sync
        widget.value = value

        // 2. Call the original callback if it exists
        if (originalCallback) {
          originalCallback.call(widget, value)
        }

        // 3. Update Vue state to maintain synchronization
        updateVueWidgetState(nodeId, widget.name, value)
      } finally {
        updateInProgress = false
      }
    }
  }

  /**
   * Sets up widget callbacks for a node - now with reduced nesting
   */
  const setupNodeWidgetCallbacks = (node: LGraphNode) => {
    if (!node.widgets) return

    const nodeId = String(node.id)

    node.widgets.forEach((widget) => {
      const originalCallback = widget.callback
      widget.callback = createWrappedWidgetCallback(
        widget,
        originalCallback,
        nodeId
      )
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

      // Set up widget callbacks BEFORE extracting data (critical order)
      setupNodeWidgetCallbacks(node)

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

  /**
   * Detects position changes for a single node and updates reactive state
   */
  const detectPositionChanges = (node: LGraphNode, id: string): boolean => {
    const currentPos = nodePositions.get(id)

    if (
      !currentPos ||
      currentPos.x !== node.pos[0] ||
      currentPos.y !== node.pos[1]
    ) {
      nodePositions.set(id, { x: node.pos[0], y: node.pos[1] })

      // Push position change to layout store
      // Source is already set to 'canvas' in detectChangesInRAF
      void moveNode(id, { x: node.pos[0], y: node.pos[1] })

      return true
    }
    return false
  }

  /**
   * Detects size changes for a single node and updates reactive state
   */
  const detectSizeChanges = (node: LGraphNode, id: string): boolean => {
    const currentSize = nodeSizes.get(id)

    if (
      !currentSize ||
      currentSize.width !== node.size[0] ||
      currentSize.height !== node.size[1]
    ) {
      nodeSizes.set(id, { width: node.size[0], height: node.size[1] })

      // Push size change to layout store
      // Source is already set to 'canvas' in detectChangesInRAF
      void resizeNode(id, {
        width: node.size[0],
        height: node.size[1]
      })

      return true
    }
    return false
  }

  /**
   * Updates spatial index for a node if bounds changed
   */
  const updateSpatialIndex = (node: LGraphNode, id: string): void => {
    const bounds: Bounds = {
      x: node.pos[0],
      y: node.pos[1],
      width: node.size[0],
      height: node.size[1]
    }
    spatialIndex.update(id, bounds)
  }

  /**
   * Updates performance metrics after change detection
   */
  const updatePerformanceMetrics = (
    startTime: number,
    positionUpdates: number,
    sizeUpdates: number
  ): void => {
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

  /**
   * Main RAF change detection function
   */
  const detectChangesInRAF = () => {
    const startTime = performance.now()

    if (!graph?._nodes) return

    let positionUpdates = 0
    let sizeUpdates = 0

    // Set source for all canvas-driven updates
    setSource(LayoutSource.Canvas)

    // Process each node for changes
    for (const node of graph._nodes) {
      const id = String(node.id)

      const posChanged = detectPositionChanges(node, id)
      const sizeChanged = detectSizeChanges(node, id)

      if (posChanged) positionUpdates++
      if (sizeChanged) sizeUpdates++

      // Update spatial index if geometry changed
      if (posChanged || sizeChanged) {
        updateSpatialIndex(node, id)
      }
    }

    updatePerformanceMetrics(startTime, positionUpdates, sizeUpdates)
  }

  /**
   * Handles node addition to the graph - sets up Vue state and spatial indexing
   * Defers position extraction until after potential configure() calls
   */
  const handleNodeAdded = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    const id = String(node.id)

    // Store non-reactive reference to original node
    nodeRefs.set(id, node)

    // Set up widget callbacks BEFORE extracting data (critical order)
    setupNodeWidgetCallbacks(node)

    // Extract initial data for Vue (may be incomplete during graph configure)
    vueNodeData.set(id, extractVueNodeData(node))

    // Set up reactive tracking state
    nodeState.set(id, {
      visible: true,
      dirty: false,
      lastUpdate: performance.now(),
      culled: false
    })

    const initializeVueNodeLayout = () => {
      // Extract actual positions after configure() has potentially updated them
      const nodePosition = { x: node.pos[0], y: node.pos[1] }
      const nodeSize = { width: node.size[0], height: node.size[1] }

      nodePositions.set(id, nodePosition)
      nodeSizes.set(id, nodeSize)
      attachMetadata(node)

      // Add to spatial index for viewport culling with final positions
      const nodeBounds: Bounds = {
        x: nodePosition.x,
        y: nodePosition.y,
        width: nodeSize.width,
        height: nodeSize.height
      }
      spatialIndex.insert(id, nodeBounds, id)

      // Add node to layout store with final positions
      setSource(LayoutSource.Canvas)
      void createNode(id, {
        position: nodePosition,
        size: nodeSize,
        zIndex: node.order || 0,
        visible: true
      })
    }

    // Check if we're in the middle of configuring the graph (workflow loading)
    if (window.app?.configuringGraph) {
      // During workflow loading - defer layout initialization until configure completes
      // Chain our callback with any existing onAfterGraphConfigured callback
      node.onAfterGraphConfigured = useChainCallback(
        node.onAfterGraphConfigured,
        () => {
          // Re-extract data now that configure() has populated title/slots/widgets/etc.
          vueNodeData.set(id, extractVueNodeData(node))
          initializeVueNodeLayout()
        }
      )
    } else {
      // Not during workflow loading - initialize layout immediately
      // This handles individual node additions during normal operation
      initializeVueNodeLayout()
    }

    // Call original callback if provided
    if (originalCallback) {
      void originalCallback(node)
    }
  }

  /**
   * Handles node removal from the graph - cleans up all references
   */
  const handleNodeRemoved = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    const id = String(node.id)

    // Remove from spatial index
    spatialIndex.remove(id)

    // Remove node from layout store
    setSource(LayoutSource.Canvas)
    void deleteNode(id)

    // Clean up all tracking references
    nodeRefs.delete(id)
    vueNodeData.delete(id)
    nodeState.delete(id)
    nodePositions.delete(id)
    nodeSizes.delete(id)
    lastNodesSnapshot.delete(id)

    // Call original callback if provided
    if (originalCallback) {
      originalCallback(node)
    }
  }

  /**
   * Creates cleanup function for event listeners and state
   */
  const createCleanupFunction = (
    originalOnNodeAdded: ((node: LGraphNode) => void) | undefined,
    originalOnNodeRemoved: ((node: LGraphNode) => void) | undefined,
    originalOnTrigger: ((action: string, param: unknown) => void) | undefined
  ) => {
    return () => {
      // Restore original callbacks
      graph.onNodeAdded = originalOnNodeAdded || undefined
      graph.onNodeRemoved = originalOnNodeRemoved || undefined
      graph.onTrigger = originalOnTrigger || undefined

      // Clear pending updates
      if (batchTimeoutId !== null) {
        clearTimeout(batchTimeoutId)
        batchTimeoutId = null
      }

      // Clear all state maps
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

  /**
   * Sets up event listeners - now simplified with extracted handlers
   */
  const setupEventListeners = (): (() => void) => {
    // Store original callbacks
    const originalOnNodeAdded = graph.onNodeAdded
    const originalOnNodeRemoved = graph.onNodeRemoved
    const originalOnTrigger = graph.onTrigger

    // Set up graph event handlers
    graph.onNodeAdded = (node: LGraphNode) => {
      handleNodeAdded(node, originalOnNodeAdded)
    }

    graph.onNodeRemoved = (node: LGraphNode) => {
      handleNodeRemoved(node, originalOnNodeRemoved)
    }

    // Listen for property change events from instrumented nodes
    graph.onTrigger = (action: string, param: unknown) => {
      if (
        action === 'node:property:changed' &&
        param &&
        typeof param === 'object'
      ) {
        const event = param as {
          nodeId: string | number
          property: string
          oldValue: unknown
          newValue: unknown
        }

        const nodeId = String(event.nodeId)
        const currentData = vueNodeData.get(nodeId)

        if (currentData) {
          if (event.property === 'title') {
            vueNodeData.set(nodeId, {
              ...currentData,
              title: String(event.newValue)
            })
          } else if (event.property === 'flags.collapsed') {
            vueNodeData.set(nodeId, {
              ...currentData,
              flags: {
                ...currentData.flags,
                collapsed: Boolean(event.newValue)
              }
            })
          }
        }
      }

      // Call original trigger handler if it exists
      if (originalOnTrigger) {
        originalOnTrigger(action, param)
      }
    }

    // Initialize state
    syncWithGraph()

    // Return cleanup function
    return createCleanupFunction(
      originalOnNodeAdded || undefined,
      originalOnNodeRemoved || undefined,
      originalOnTrigger || undefined
    )
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
    vueNodeData,
    nodeState,
    nodePositions,
    nodeSizes,
    getNode,
    setupEventListeners,
    cleanup,
    scheduleUpdate,
    forceSync: syncWithGraph,
    detectChangesInRAF,
    getVisibleNodeIds,
    performanceMetrics,
    spatialMetrics,
    getSpatialIndexDebugInfo: () => spatialIndex.getDebugInfo()
  }
}
