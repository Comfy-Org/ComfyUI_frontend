/**
 * Composable for integrating Vue components with the Layout system
 *
 * Uses customRef for shared write access and provides clean mutation API.
 * CRDT-ready with operation tracking.
 */
import log from 'loglevel'
import { computed, inject, onUnmounted } from 'vue'

import { layoutMutations } from '@/services/layoutMutations'
import { layoutStore } from '@/stores/layoutStore'
import type { Bounds, NodeId, Point } from '@/types/layoutTypes'

// Create a logger for layout debugging
const logger = log.getLogger('layout')
// In dev mode, always show debug logs
if (import.meta.env.DEV) {
  logger.setLevel('debug')
}

/**
 * Main composable for accessing the layout system
 */
export function useLayout() {
  return {
    // Store access
    store: layoutStore,

    // Mutation API
    mutations: layoutMutations,

    // Reactive accessors
    getNodeLayoutRef: (nodeId: NodeId) => layoutStore.getNodeLayoutRef(nodeId),
    getAllNodes: () => layoutStore.getAllNodes(),
    getNodesInBounds: (bounds: Bounds) => layoutStore.getNodesInBounds(bounds),

    // Non-reactive queries (for performance)
    queryNodeAtPoint: (point: Point) => layoutStore.queryNodeAtPoint(point),
    queryNodesInBounds: (bounds: Bounds) =>
      layoutStore.queryNodesInBounds(bounds)
  }
}

/**
 * Composable for individual Vue node components
 * Uses customRef for shared write access with Canvas renderer
 */
export function useNodeLayout(nodeId: string) {
  const { store, mutations } = useLayout()

  // Get transform utilities from TransformPane if available
  const transformState = inject('transformState') as
    | {
        canvasToScreen: (point: Point) => Point
        screenToCanvas: (point: Point) => Point
      }
    | undefined

  // Get the customRef for this node (shared write access)
  const layoutRef = store.getNodeLayoutRef(nodeId)

  logger.debug(`useNodeLayout initialized for node ${nodeId}`, {
    hasLayout: !!layoutRef.value,
    initialPosition: layoutRef.value?.position
  })

  // Computed properties for easy access
  const position = computed(() => {
    const layout = layoutRef.value
    const pos = layout?.position ?? { x: 0, y: 0 }
    logger.debug(`Node ${nodeId} position computed:`, {
      pos,
      hasLayout: !!layout,
      layoutRefValue: layout
    })
    return pos
  })
  const size = computed(
    () => layoutRef.value?.size ?? { width: 200, height: 100 }
  )
  const bounds = computed(
    () =>
      layoutRef.value?.bounds ?? {
        x: position.value.x,
        y: position.value.y,
        width: size.value.width,
        height: size.value.height
      }
  )
  const isVisible = computed(() => layoutRef.value?.visible ?? true)
  const zIndex = computed(() => layoutRef.value?.zIndex ?? 0)

  // Drag state
  let isDragging = false
  let dragStartPos: Point | null = null
  let dragStartMouse: Point | null = null

  /**
   * Start dragging the node
   */
  function startDrag(event: PointerEvent) {
    if (!layoutRef.value) return

    isDragging = true
    dragStartPos = { ...position.value }
    dragStartMouse = { x: event.clientX, y: event.clientY }

    // Set mutation source
    mutations.setSource('vue')

    // Capture pointer
    const target = event.target as HTMLElement
    target.setPointerCapture(event.pointerId)
  }

  /**
   * Handle drag movement
   */
  const handleDrag = (event: PointerEvent) => {
    if (!isDragging || !dragStartPos || !dragStartMouse || !transformState) {
      logger.debug(`Drag skipped for node ${nodeId}:`, {
        isDragging,
        hasDragStartPos: !!dragStartPos,
        hasDragStartMouse: !!dragStartMouse,
        hasTransformState: !!transformState
      })
      return
    }

    // Calculate mouse delta in screen coordinates
    const mouseDelta = {
      x: event.clientX - dragStartMouse.x,
      y: event.clientY - dragStartMouse.y
    }

    // Convert to canvas coordinates
    const canvasOrigin = transformState.screenToCanvas({ x: 0, y: 0 })
    const canvasWithDelta = transformState.screenToCanvas(mouseDelta)
    const canvasDelta = {
      x: canvasWithDelta.x - canvasOrigin.x,
      y: canvasWithDelta.y - canvasOrigin.y
    }

    // Calculate new position
    const newPosition = {
      x: dragStartPos.x + canvasDelta.x,
      y: dragStartPos.y + canvasDelta.y
    }

    logger.debug(`Dragging node ${nodeId}:`, {
      mouseDelta,
      canvasDelta,
      newPosition,
      currentLayoutPos: layoutRef.value?.position
    })

    // Apply mutation through the layout system
    mutations.moveNode(nodeId, newPosition)
  }

  /**
   * End dragging
   */
  function endDrag(event: PointerEvent) {
    if (!isDragging) return

    isDragging = false
    dragStartPos = null
    dragStartMouse = null

    // Release pointer
    const target = event.target as HTMLElement
    target.releasePointerCapture(event.pointerId)
  }

  /**
   * Update node position directly (without drag)
   */
  function moveTo(position: Point) {
    mutations.setSource('vue')
    mutations.moveNode(nodeId, position)
  }

  /**
   * Update node size
   */
  function resize(newSize: { width: number; height: number }) {
    mutations.setSource('vue')
    mutations.resizeNode(nodeId, newSize)
  }

  return {
    // Reactive state (via customRef)
    layoutRef,
    position,
    size,
    bounds,
    isVisible,
    zIndex,

    // Mutations
    moveTo,
    resize,

    // Drag handlers
    startDrag,
    handleDrag,
    endDrag,

    // Computed styles for Vue templates
    nodeStyle: computed(() => ({
      position: 'absolute' as const,
      left: `${position.value.x}px`,
      top: `${position.value.y}px`,
      width: `${size.value.width}px`,
      height: `${size.value.height}px`,
      zIndex: zIndex.value,
      cursor: isDragging ? 'grabbing' : 'grab'
    }))
  }
}

/**
 * Composable for syncing LiteGraph with the Layout system
 * This replaces the bidirectional sync with a one-way sync
 */
export function useLayoutSync() {
  const { store } = useLayout()

  let unsubscribe: (() => void) | null = null

  /**
   * Start syncing from Layout system to LiteGraph
   * This is one-way: Layout → LiteGraph only
   */
  function startSync(canvas: any) {
    if (!canvas?.graph) return

    // Subscribe to layout changes
    unsubscribe = store.onChange((change) => {
      logger.debug('Layout sync received change:', {
        source: change.source,
        nodeIds: change.nodeIds,
        type: change.type
      })

      // Apply changes to LiteGraph regardless of source
      // The layout store is the single source of truth
      for (const nodeId of change.nodeIds) {
        const layout = store.getNodeLayoutRef(nodeId).value
        if (!layout) continue

        const liteNode = canvas.graph.getNodeById(parseInt(nodeId))
        if (!liteNode) continue

        // Update position if changed
        if (
          liteNode.pos[0] !== layout.position.x ||
          liteNode.pos[1] !== layout.position.y
        ) {
          logger.debug(`Updating LiteGraph node ${nodeId} position:`, {
            from: { x: liteNode.pos[0], y: liteNode.pos[1] },
            to: layout.position
          })
          liteNode.pos[0] = layout.position.x
          liteNode.pos[1] = layout.position.y
        }

        // Update size if changed
        if (
          liteNode.size[0] !== layout.size.width ||
          liteNode.size[1] !== layout.size.height
        ) {
          liteNode.size[0] = layout.size.width
          liteNode.size[1] = layout.size.height
        }
      }

      // Trigger single redraw for all changes
      canvas.setDirty(true, true)
    })
  }

  /**
   * Stop syncing
   */
  function stopSync() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    stopSync()
  })

  return {
    startSync,
    stopSync
  }
}
