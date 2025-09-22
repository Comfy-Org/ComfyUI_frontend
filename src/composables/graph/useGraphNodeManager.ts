/**
 * Vue node lifecycle management for LiteGraph integration
 * Provides event-driven reactivity with performance optimizations
 */
import { reactive } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { WidgetValue } from '@/types/simplifiedWidget'

import type { LGraph, LGraphNode } from '../../lib/litegraph/src/litegraph'

interface NodeMetadata {
  lastRenderTime: number
  cachedBounds: DOMRect | null
  lodLevel: 'high' | 'medium' | 'low'
}
export interface SafeWidgetData {
  name: string
  type: string
  value: WidgetValue
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
  subgraphId?: string | null
  widgets?: SafeWidgetData[]
  inputs?: unknown[]
  outputs?: unknown[]
  hasErrors?: boolean
  flags?: {
    collapsed?: boolean
  }
}

export interface GraphNodeManager {
  // Reactive state - safe data extracted from LiteGraph nodes
  vueNodeData: ReadonlyMap<string, VueNodeData>

  // Access to original LiteGraph nodes (non-reactive)
  getNode(id: string): LGraphNode | undefined

  // Lifecycle methods
  cleanup(): void
}

export function useGraphNodeManager(graph: LGraph): GraphNodeManager {
  // Get layout mutations composable
  const { createNode, deleteNode, setSource } = useLayoutMutations()
  // Safe reactive data extracted from LiteGraph nodes
  const vueNodeData = reactive(new Map<string, VueNodeData>())

  // Non-reactive storage for original LiteGraph nodes
  const nodeRefs = new Map<string, LGraphNode>()

  // WeakMap for heavy data that auto-GCs when nodes are removed
  const nodeMetadata = new WeakMap<LGraphNode, NodeMetadata>()

  const attachMetadata = (node: LGraphNode) => {
    nodeMetadata.set(node, {
      lastRenderTime: performance.now(),
      cachedBounds: null,
      lodLevel: 'high'
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
          value: undefined, // Already a valid WidgetValue
          options: undefined,
          callback: undefined
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

  const syncWithGraph = () => {
    if (!graph?._nodes) return

    const currentNodes = new Set(graph._nodes.map((n) => String(n.id)))

    // Remove deleted nodes
    for (const id of Array.from(vueNodeData.keys())) {
      if (!currentNodes.has(id)) {
        nodeRefs.delete(id)
        vueNodeData.delete(id)
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

      if (!nodeMetadata.has(node)) {
        attachMetadata(node)
      }
    })
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

    const initializeVueNodeLayout = () => {
      // Extract actual positions after configure() has potentially updated them
      const nodePosition = { x: node.pos[0], y: node.pos[1] }
      const nodeSize = { width: node.size[0], height: node.size[1] }

      attachMetadata(node)

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

    // Remove node from layout store
    setSource(LayoutSource.Canvas)
    void deleteNode(id)

    // Clean up all tracking references
    nodeRefs.delete(id)
    vueNodeData.delete(id)

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

      // Clear all state maps
      nodeRefs.clear()
      vueNodeData.clear()
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
          switch (event.property) {
            case 'title':
              vueNodeData.set(nodeId, {
                ...currentData,
                title: String(event.newValue)
              })
              break
            case 'flags.collapsed':
              vueNodeData.set(nodeId, {
                ...currentData,
                flags: {
                  ...currentData.flags,
                  collapsed: Boolean(event.newValue)
                }
              })
              break
            case 'mode':
              vueNodeData.set(nodeId, {
                ...currentData,
                mode: typeof event.newValue === 'number' ? event.newValue : 0
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
    getNode,
    cleanup
  }
}
