/**
 * Node State Management
 *
 * Manages node visibility, dirty state, and other UI state.
 * Provides reactive state for Vue components.
 */
import { nextTick, reactive, readonly } from 'vue'

import { PERFORMANCE_CONFIG } from '@/constants/layout'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import type { SafeWidgetData, VueNodeData, WidgetValue } from './useNodeWidgets'

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
}

/**
 * Extract safe Vue data from LiteGraph node
 */
export function extractVueNodeData(
  node: LGraphNode,
  widgets?: SafeWidgetData[]
): VueNodeData {
  return {
    id: String(node.id),
    title: node.title || 'Untitled',
    type: node.type || 'Unknown',
    mode: node.mode || 0,
    selected: node.selected || false,
    executing: false, // Will be updated separately based on execution state
    widgets,
    inputs: node.inputs ? [...node.inputs] : undefined,
    outputs: node.outputs ? [...node.outputs] : undefined,
    flags: node.flags ? { ...node.flags } : undefined
  }
}

/**
 * Node state management composable
 */
export function useNodeState() {
  // Reactive state maps
  const vueNodeData = reactive(new Map<string, VueNodeData>())
  const nodeState = reactive(new Map<string, NodeState>())
  const nodePositions = reactive(new Map<string, { x: number; y: number }>())
  const nodeSizes = reactive(
    new Map<string, { width: number; height: number }>()
  )

  // Non-reactive node references
  const nodeRefs = new Map<string, LGraphNode>()

  // WeakMap for heavy metadata that auto-GCs
  const nodeMetadata = new WeakMap<LGraphNode, NodeMetadata>()

  // Update batching
  const pendingUpdates = new Set<string>()
  const criticalUpdates = new Set<string>()
  const lowPriorityUpdates = new Set<string>()
  let updateScheduled = false
  let batchTimeoutId: number | null = null

  /**
   * Attach metadata to a node
   */
  const attachMetadata = (node: LGraphNode) => {
    nodeMetadata.set(node, {
      lastRenderTime: performance.now(),
      cachedBounds: null,
      lodLevel: 'high'
    })
  }

  /**
   * Get access to original LiteGraph node
   */
  const getNode = (id: string): LGraphNode | undefined => {
    return nodeRefs.get(id)
  }

  /**
   * Schedule an update for a node
   */
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
        batchTimeoutId = window.setTimeout(
          () => flush(),
          PERFORMANCE_CONFIG.BATCH_UPDATE_DELAY
        )
      }
    }
  }

  /**
   * Flush all pending updates
   */
  const flush = () => {
    if (batchTimeoutId !== null) {
      clearTimeout(batchTimeoutId)
      batchTimeoutId = null
    }

    // Clear all pending updates
    criticalUpdates.clear()
    pendingUpdates.clear()
    lowPriorityUpdates.clear()
    updateScheduled = false

    // Trigger any additional update logic here
  }

  /**
   * Initialize node state
   */
  const initializeNode = (node: LGraphNode, vueData: VueNodeData): void => {
    const id = String(node.id)

    // Store references
    nodeRefs.set(id, node)
    vueNodeData.set(id, vueData)

    // Initialize state
    nodeState.set(id, {
      visible: true,
      dirty: false,
      lastUpdate: performance.now(),
      culled: false
    })

    // Initialize position and size
    nodePositions.set(id, { x: node.pos[0], y: node.pos[1] })
    nodeSizes.set(id, { width: node.size[0], height: node.size[1] })

    // Attach metadata
    attachMetadata(node)
  }

  /**
   * Clean up node state
   */
  const cleanupNode = (nodeId: string): void => {
    nodeRefs.delete(nodeId)
    vueNodeData.delete(nodeId)
    nodeState.delete(nodeId)
    nodePositions.delete(nodeId)
    nodeSizes.delete(nodeId)
  }

  /**
   * Update node property
   */
  const updateNodeProperty = (
    nodeId: string,
    property: string,
    value: unknown
  ): void => {
    const currentData = vueNodeData.get(nodeId)
    if (!currentData) return

    if (property === 'title') {
      vueNodeData.set(nodeId, {
        ...currentData,
        title: String(value)
      })
    } else if (property === 'flags.collapsed') {
      vueNodeData.set(nodeId, {
        ...currentData,
        flags: {
          ...currentData.flags,
          collapsed: Boolean(value)
        }
      })
    }
  }

  /**
   * Update widget state
   */
  const updateWidgetState = (
    nodeId: string,
    widgetName: string,
    value: unknown
  ): void => {
    const currentData = vueNodeData.get(nodeId)
    if (!currentData?.widgets) return

    const updatedWidgets = currentData.widgets.map((w) =>
      w.name === widgetName ? { ...w, value: value as WidgetValue } : w
    )
    vueNodeData.set(nodeId, {
      ...currentData,
      widgets: updatedWidgets
    })
  }

  return {
    // State maps (read-only)
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

    // Methods
    getNode,
    attachMetadata,
    scheduleUpdate,
    flush,
    initializeNode,
    cleanupNode,
    updateNodeProperty,
    updateWidgetState,

    // Mutable access for internal use
    _mutableNodePositions: nodePositions,
    _mutableNodeSizes: nodeSizes
  }
}
