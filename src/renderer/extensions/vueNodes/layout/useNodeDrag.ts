import { storeToRefs } from 'pinia'
import { toValue } from 'vue'

import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { AutoPanController } from '@/renderer/core/canvas/useAutoPan'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type {
  NodeBoundsUpdate,
  NodeId,
  Point
} from '@/renderer/core/layout/types'
import { useNodeSnap } from '@/renderer/extensions/vueNodes/composables/useNodeSnap'
import { useShiftKeySync } from '@/renderer/extensions/vueNodes/composables/useShiftKeySync'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { isLGraphGroup } from '@/utils/litegraphUtil'
import { createSharedComposable } from '@vueuse/core'

export const useNodeDrag = createSharedComposable(useNodeDragIndividual)

function useNodeDragIndividual() {
  const mutations = useLayoutMutations()
  const { selectedNodeIds, selectedItems } = storeToRefs(useCanvasStore())

  // Get transform utilities from TransformPane if available
  const transformState = useTransformState()

  // Snap-to-grid functionality
  const { shouldSnap, applySnapToPosition } = useNodeSnap()

  // Shift key sync for LiteGraph canvas preview
  const { trackShiftKey } = useShiftKeySync()

  const canvasStore = useCanvasStore()

  // Drag state
  let dragStartPos: Point | null = null
  let dragStartMouse: Point | null = null
  let otherSelectedNodesStartPositions: Map<string, Point> | null = null
  let rafId: number | null = null
  let stopShiftSync: (() => void) | null = null

  // For groups: track the last applied canvas delta to compute frame delta
  let lastCanvasDelta: Point | null = null
  let selectedGroups: LGraphGroup[] | null = null

  // Auto-pan state
  let autoPan: AutoPanController | null = null
  let lastPointerX = 0
  let lastPointerY = 0

  function startDrag(event: PointerEvent, nodeId: NodeId) {
    const layout = toValue(layoutStore.getNodeLayoutRef(nodeId))
    if (!layout) return
    const position = layout.position ?? { x: 0, y: 0 }

    // Track shift key state and sync to canvas for snap preview
    stopShiftSync = trackShiftKey(event)

    dragStartPos = { ...position }
    dragStartMouse = { x: event.clientX, y: event.clientY }
    lastPointerX = event.clientX
    lastPointerY = event.clientY

    const selectedNodes = toValue(selectedNodeIds)

    // capture the starting positions of all other selected nodes
    // Only move other selected items if the dragged node is part of the selection
    const isDraggedNodeInSelection = selectedNodes?.has(nodeId)

    if (isDraggedNodeInSelection && selectedNodes.size > 1) {
      otherSelectedNodesStartPositions = new Map()

      for (const id of selectedNodes) {
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

    // Capture selected groups only if the dragged node is part of the selection
    // This prevents groups from moving when dragging an unrelated node
    if (isDraggedNodeInSelection) {
      selectedGroups = toValue(selectedItems).filter(isLGraphGroup)
      lastCanvasDelta = { x: 0, y: 0 }
    } else {
      selectedGroups = null
      lastCanvasDelta = null
    }

    mutations.setSource(LayoutSource.Vue)

    // Start auto-pan
    const lgCanvas = canvasStore.canvas
    if (lgCanvas?.ds) {
      autoPan = new AutoPanController({
        canvas: lgCanvas.canvas,
        ds: lgCanvas.ds,
        maxPanSpeed: lgCanvas.auto_pan_speed,
        onPan: (panX, panY) => {
          if (dragStartPos) {
            dragStartPos.x += panX
            dragStartPos.y += panY
          }
          if (otherSelectedNodesStartPositions) {
            for (const pos of otherSelectedNodesStartPositions.values()) {
              pos.x += panX
              pos.y += panY
            }
          }
          if (selectedGroups) {
            for (const group of selectedGroups) {
              group.move(panX, panY, true)
            }
          }
          updateNodePositions(nodeId)
        }
      })
      autoPan.updatePointer(event.clientX, event.clientY)
      autoPan.start()
    }
  }

  /**
   * Recalculates all dragged node positions based on the current mouse
   * position and canvas transform.
   */
  function updateNodePositions(nodeId: NodeId) {
    if (!dragStartPos || !dragStartMouse) return

    const mouseDelta = {
      x: lastPointerX - dragStartMouse.x,
      y: lastPointerY - dragStartMouse.y
    }

    const canvasOrigin = transformState.screenToCanvas({ x: 0, y: 0 })
    const canvasWithDelta = transformState.screenToCanvas(mouseDelta)
    const canvasDelta = {
      x: canvasWithDelta.x - canvasOrigin.x,
      y: canvasWithDelta.y - canvasOrigin.y
    }

    mutations.moveNode(nodeId, {
      x: dragStartPos.x + canvasDelta.x,
      y: dragStartPos.y + canvasDelta.y
    })

    if (
      otherSelectedNodesStartPositions &&
      otherSelectedNodesStartPositions.size > 0
    ) {
      for (const [otherNodeId, startPos] of otherSelectedNodesStartPositions) {
        mutations.moveNode(otherNodeId, {
          x: startPos.x + canvasDelta.x,
          y: startPos.y + canvasDelta.y
        })
      }
    }

    if (selectedGroups && selectedGroups.length > 0 && lastCanvasDelta) {
      const frameDelta = {
        x: canvasDelta.x - lastCanvasDelta.x,
        y: canvasDelta.y - lastCanvasDelta.y
      }

      for (const group of selectedGroups) {
        group.move(frameDelta.x, frameDelta.y, true)
      }
    }

    lastCanvasDelta = canvasDelta
  }

  function handleDrag(event: PointerEvent, nodeId: NodeId) {
    if (!dragStartPos || !dragStartMouse) {
      return
    }

    // Throttle position updates using requestAnimationFrame for better performance
    if (rafId !== null) return // Skip if frame already scheduled

    const { target, pointerId } = event
    if (target instanceof HTMLElement && !target.hasPointerCapture(pointerId)) {
      // Delay capture to drag to allow for the Node cloning
      target.setPointerCapture(pointerId)
    }

    lastPointerX = event.clientX
    lastPointerY = event.clientY
    autoPan?.updatePointer(event.clientX, event.clientY)

    rafId = requestAnimationFrame(() => {
      rafId = null
      updateNodePositions(nodeId)
    })
  }

  function endDrag(event: PointerEvent, nodeId: NodeId | undefined) {
    // Apply snap to final position if snap was active (matches LiteGraph behavior)
    if (shouldSnap(event) && nodeId) {
      const boundsUpdates: NodeBoundsUpdate[] = []

      // Snap main node
      const currentLayout = toValue(layoutStore.getNodeLayoutRef(nodeId))
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

    dragStartPos = null
    dragStartMouse = null
    otherSelectedNodesStartPositions = null
    selectedGroups = null
    lastCanvasDelta = null

    // Stop auto-pan
    autoPan?.stop()
    autoPan = null

    // Stop tracking shift key state
    stopShiftSync?.()
    stopShiftSync = null

    // Cancel any pending animation frame
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  return {
    startDrag,
    handleDrag,
    endDrag
  }
}
