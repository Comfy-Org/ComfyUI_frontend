import { storeToRefs } from 'pinia'
import {
  type CSSProperties,
  type MaybeRefOrGetter,
  computed,
  inject,
  ref,
  toValue
} from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { TransformStateKey } from '@/renderer/core/layout/injectionKeys'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource, type Point } from '@/renderer/core/layout/types'

/**
 * Composable for individual Vue node components
 * Uses customRef for shared write access with Canvas renderer
 */
export function useNodeLayout(nodeIdMaybe: MaybeRefOrGetter<string>) {
  const nodeId = toValue(nodeIdMaybe)
  const mutations = useLayoutMutations()
  const { selectedNodeIds } = storeToRefs(useCanvasStore())

  // Get transform utilities from TransformPane if available
  const transformState = inject(TransformStateKey)

  // Get the customRef for this node (shared write access)
  const layoutRef = layoutStore.getNodeLayoutRef(nodeId)

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
  const isDragging = ref(false)
  let dragStartPos: Point | null = null
  let dragStartMouse: Point | null = null
  let otherSelectedNodesStartPositions: Map<string, Point> | null = null

  /**
   * Start dragging the node
   * @returns {boolean} True if drag started successfully, false otherwise
   */
  function startDrag(event: PointerEvent): boolean {
    if (!layoutRef.value || !transformState) return false

    isDragging.value = true
    dragStartPos = { ...position.value }
    dragStartMouse = { x: event.clientX, y: event.clientY }

    // capture the starting positions of all other selected nodes
    if (selectedNodeIds?.value?.has(nodeId) && selectedNodeIds.value.size > 1) {
      otherSelectedNodesStartPositions = new Map()

      // Iterate through all selected node IDs
      for (const id of selectedNodeIds.value) {
        // Skip the current node being dragged
        if (id === nodeId) continue

        const nodeLayout = layoutStore.getNodeLayoutRef(id).value
        if (nodeLayout) {
          otherSelectedNodesStartPositions.set(id, { ...nodeLayout.position })
        }
      }
    } else {
      otherSelectedNodesStartPositions = null
    }

    // Set mutation source
    mutations.setSource(LayoutSource.Vue)

    // Capture pointer
    if (!(event.target instanceof HTMLElement)) return false
    event.target.setPointerCapture(event.pointerId)

    return true
  }

  /**
   * Handle drag movement
   */
  const handleDrag = (event: PointerEvent) => {
    if (
      !isDragging.value ||
      !dragStartPos ||
      !dragStartMouse ||
      !transformState
    ) {
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

    // Calculate new position for the current node
    const newPosition = {
      x: dragStartPos.x + canvasDelta.x,
      y: dragStartPos.y + canvasDelta.y
    }

    // Apply mutation through the layout system
    mutations.moveNode(nodeId, newPosition)

    // If we're dragging multiple selected nodes, move them all together
    if (
      otherSelectedNodesStartPositions &&
      otherSelectedNodesStartPositions.size > 0
    ) {
      for (const [otherNodeId, startPos] of otherSelectedNodesStartPositions) {
        const newOtherPosition = {
          x: startPos.x + canvasDelta.x,
          y: startPos.y + canvasDelta.y
        }
        mutations.moveNode(otherNodeId, newOtherPosition)
      }
    }
  }

  /**
   * End dragging
   */
  function endDrag(event: PointerEvent) {
    if (!isDragging.value) return

    isDragging.value = false
    dragStartPos = null
    dragStartMouse = null
    otherSelectedNodesStartPositions = null

    // Release pointer
    if (!(event.target instanceof HTMLElement)) return
    event.target.releasePointerCapture(event.pointerId)
  }

  /**
   * Update node position directly (without drag)
   */
  function moveTo(position: Point) {
    mutations.setSource(LayoutSource.Vue)
    mutations.moveNode(nodeId, position)
  }

  /**
   * Update node size
   */
  function resize(newSize: { width: number; height: number }) {
    mutations.setSource(LayoutSource.Vue)
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
    isDragging,

    // Mutations
    moveTo,
    resize,

    // Drag handlers
    startDrag,
    handleDrag,
    endDrag,

    // Computed styles for Vue templates
    nodeStyle: computed(
      (): CSSProperties => ({
        position: 'absolute' as const,
        left: `${position.value.x}px`,
        top: `${position.value.y}px`,
        width: `${size.value.width}px`,
        height: `${size.value.height}px`,
        zIndex: zIndex.value,
        cursor: isDragging.value ? 'grabbing' : 'grab'
      })
    )
  }
}
