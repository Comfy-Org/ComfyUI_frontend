/**
 * Composable for individual Vue node components
 *
 * Uses customRef for shared write access with Canvas renderer.
 * Provides dragging functionality and reactive layout state.
 */
import { computed, inject } from 'vue'

import { registerNodeSlots } from '@/renderer/core/canvas/litegraph/SlotCalculations'
import type { SlotPositionContext } from '@/renderer/core/canvas/litegraph/SlotCalculations'
import { layoutMutations } from '@/renderer/core/layout/operations/LayoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/LayoutStore'
import type { Point } from '@/renderer/core/layout/types'
import { app } from '@/scripts/app'

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

  // Computed properties for easy access
  const position = computed(() => {
    const layout = layoutRef.value
    const pos = layout?.position ?? { x: 0, y: 0 }
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

  /**
   * Update slot layouts for this node
   * Should be called whenever the node's slots or position changes
   */
  function updateSlotLayouts() {
    if (!layoutRef.value || !app.graph) return

    const node = app.graph.getNodeById(Number(nodeId))
    if (!node) return

    // Create context for slot position calculation
    const context: SlotPositionContext = {
      nodeX: layoutRef.value.position.x,
      nodeY: layoutRef.value.position.y,
      nodeWidth: layoutRef.value.size.width,
      nodeHeight: layoutRef.value.size.height,
      collapsed: node.flags?.collapsed || false,
      collapsedWidth: node._collapsed_width,
      slotStartY: node.constructor.slot_start_y,
      inputs: node.inputs || [],
      outputs: node.outputs || [],
      widgets: node.widgets
    }

    // Register all slots for this node
    registerNodeSlots(nodeId, context)
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
    updateSlotLayouts,

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
