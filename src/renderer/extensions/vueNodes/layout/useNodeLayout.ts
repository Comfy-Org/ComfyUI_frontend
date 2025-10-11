import { storeToRefs } from 'pinia'
import { computed, inject, ref, toValue } from 'vue'
import type { CSSProperties, MaybeRefOrGetter } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { TransformStateKey } from '@/renderer/core/layout/injectionKeys'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeBoundsUpdate, Point } from '@/renderer/core/layout/types'
import { useNodeSnap } from '@/renderer/extensions/vueNodes/composables/useNodeSnap'
import { useShiftKeySync } from '@/renderer/extensions/vueNodes/composables/useShiftKeySync'

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

  // Snap-to-grid functionality
  const { shouldSnap, applySnapToPosition } = useNodeSnap()

  // Shift key sync for LiteGraph canvas preview
  const { trackShiftKey } = useShiftKeySync()

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
  let rafId: number | null = null
  let stopShiftSync: (() => void) | null = null

  /**
   * Start dragging the node
   */
  function startDrag(event: PointerEvent) {
    if (!layoutRef.value || !transformState) return

    // Track shift key state and sync to canvas for snap preview
    stopShiftSync = trackShiftKey(event)

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
    if (!(event.target instanceof HTMLElement)) return
    event.target.setPointerCapture(event.pointerId)
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

    // Throttle position updates using requestAnimationFrame for better performance
    if (rafId !== null) return // Skip if frame already scheduled

    rafId = requestAnimationFrame(() => {
      rafId = null

      if (!dragStartPos || !dragStartMouse || !transformState) return

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

      // Apply mutation through the layout system (Vue batches DOM updates automatically)
      mutations.moveNode(nodeId, newPosition)

      // If we're dragging multiple selected nodes, move them all together
      if (
        otherSelectedNodesStartPositions &&
        otherSelectedNodesStartPositions.size > 0
      ) {
        for (const [
          otherNodeId,
          startPos
        ] of otherSelectedNodesStartPositions) {
          const newOtherPosition = {
            x: startPos.x + canvasDelta.x,
            y: startPos.y + canvasDelta.y
          }
          mutations.moveNode(otherNodeId, newOtherPosition)
        }
      }
    })
  }

  /**
   * End dragging
   */
  function endDrag(event: PointerEvent) {
    if (!isDragging.value) return

    // Apply snap to final position if snap was active (matches LiteGraph behavior)
    if (shouldSnap(event)) {
      const boundsUpdates: NodeBoundsUpdate[] = []

      // Snap main node
      const currentLayout = layoutStore.getNodeLayoutRef(nodeId).value
      if (currentLayout) {
        const currentPos = currentLayout.position
        const snappedPos = applySnapToPosition({ ...currentPos })

        // Only add update if position actually changed
        if (snappedPos.x !== currentPos.x || snappedPos.y !== currentPos.y) {
          boundsUpdates.push({
            nodeId,
            bounds: {
              x: snappedPos.x,
              y: snappedPos.y,
              width: currentLayout.size.width,
              height: currentLayout.size.height
            }
          })
        }
      }

      // Also snap other selected nodes
      // Capture all positions at the start to ensure consistent state
      if (
        otherSelectedNodesStartPositions &&
        otherSelectedNodesStartPositions.size > 0
      ) {
        for (const otherNodeId of otherSelectedNodesStartPositions.keys()) {
          const nodeLayout = layoutStore.getNodeLayoutRef(otherNodeId).value
          if (nodeLayout) {
            const currentPos = { ...nodeLayout.position }
            const snappedPos = applySnapToPosition(currentPos)

            // Only add update if position actually changed
            if (
              snappedPos.x !== currentPos.x ||
              snappedPos.y !== currentPos.y
            ) {
              boundsUpdates.push({
                nodeId: otherNodeId,
                bounds: {
                  x: snappedPos.x,
                  y: snappedPos.y,
                  width: nodeLayout.size.width,
                  height: nodeLayout.size.height
                }
              })
            }
          }
        }
      }

      // Apply all snap updates in a single batched transaction
      if (boundsUpdates.length > 0) {
        layoutStore.batchUpdateNodeBounds(boundsUpdates)
      }
    }

    isDragging.value = false
    dragStartPos = null
    dragStartMouse = null
    otherSelectedNodesStartPositions = null

    // Stop tracking shift key state
    stopShiftSync?.()
    stopShiftSync = null

    // Cancel any pending animation frame
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

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
