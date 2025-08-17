/**
 * Composable for individual Vue node components
 *
 * Uses customRef for shared write access with Canvas renderer.
 * Provides dragging functionality and reactive layout state.
 */
import log from 'loglevel'
import { computed, inject } from 'vue'

import { layoutMutations } from '@/services/layoutMutations'
import { layoutStore } from '@/stores/layoutStore'
import type { Point } from '@/types/layoutTypes'

// Create a logger for layout debugging
const logger = log.getLogger('layout')
// In dev mode, always show debug logs
if (import.meta.env.DEV) {
  logger.setLevel('debug')
}

/**
 * Composable for individual Vue node components
 * Uses customRef for shared write access with Canvas renderer
 */
export function useNodeLayout(nodeId: string) {
  const store = layoutStore
  const mutations = layoutMutations

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
