import { storeToRefs } from 'pinia'
import { toValue } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type {
  Bounds,
  NodeAlignmentGuide,
  NodeBoundsUpdate,
  NodeId,
  Point
} from '@/renderer/core/layout/types'
import { translateBounds } from '@/renderer/core/layout/utils/geometry'
import { useNodeSnap } from '@/renderer/extensions/vueNodes/composables/useNodeSnap'
import { useShiftKeySync } from '@/renderer/extensions/vueNodes/composables/useShiftKeySync'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { isLGraphGroup } from '@/utils/litegraphUtil'
import { createSharedComposable } from '@vueuse/core'

import type { NodeAlignmentSnapResult } from './nodeAlignmentSnap'
import { resolveNodeAlignmentSnap } from './nodeAlignmentSnap'

export const useNodeDrag = createSharedComposable(useNodeDragIndividual)

const SNAP_SEARCH_RADIUS_PX = 96

function useNodeDragIndividual() {
  const canvasStore = useCanvasStore()
  const mutations = useLayoutMutations()
  const { selectedNodeIds, selectedItems } = storeToRefs(canvasStore)
  const settingStore = useSettingStore()

  // Get transform utilities from TransformPane if available
  const transformState = useTransformState()

  // Snap-to-grid functionality
  const { shouldSnap: shouldSnapToGrid, applySnapToPosition } = useNodeSnap()

  // Shift key sync for LiteGraph canvas preview
  const { trackShiftKey } = useShiftKeySync()

  // Drag state
  let dragStartPos: Point | null = null
  let dragStartMouse: Point | null = null
  let otherSelectedNodesStartPositions: Map<string, Point> | null = null
  let pendingDragEvent: PointerEvent | null = null
  let rafId: number | null = null
  let stopShiftSync: (() => void) | null = null

  // For groups: track the last applied canvas delta to compute frame delta
  let lastCanvasDelta: Point | null = null
  let selectedGroups: LGraphGroup[] | null = null
  let draggedSelectionBounds: Bounds | null = null
  let draggedSelectionNodeIds: Set<NodeId> | null = null

  function startDrag(event: PointerEvent, nodeId: NodeId) {
    const layout = toValue(layoutStore.getNodeLayoutRef(nodeId))
    if (!layout) return
    const position = layout.position ?? { x: 0, y: 0 }

    // Track shift key state and sync to canvas for snap preview
    stopShiftSync = trackShiftKey(event)

    dragStartPos = { ...position }
    dragStartMouse = { x: event.clientX, y: event.clientY }
    pendingDragEvent = null

    const selectedNodes = toValue(selectedNodeIds)
    const isDraggedNodeInSelection = selectedNodes.has(nodeId)
    draggedSelectionNodeIds = isDraggedNodeInSelection
      ? new Set(selectedNodes)
      : new Set([nodeId])
    draggedSelectionBounds = getDraggedSelectionBounds(draggedSelectionNodeIds)
    updateDragSnapGuides([])

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
  }

  function handleDrag(event: PointerEvent, nodeId: NodeId) {
    if (!dragStartPos || !dragStartMouse) {
      return
    }

    const { target, pointerId } = event
    if (target instanceof HTMLElement && !target.hasPointerCapture(pointerId)) {
      // Delay capture to drag to allow for the Node cloning
      target.setPointerCapture(pointerId)
    }
    pendingDragEvent = event

    // Throttle position updates using requestAnimationFrame for better performance
    if (rafId !== null) return // Skip if frame already scheduled

    rafId = requestAnimationFrame(() => {
      rafId = null

      if (!dragStartPos || !dragStartMouse || !pendingDragEvent) return

      const dragEvent = pendingDragEvent
      pendingDragEvent = null

      // Calculate mouse delta in screen coordinates
      const mouseDelta = {
        x: dragEvent.clientX - dragStartMouse.x,
        y: dragEvent.clientY - dragStartMouse.y
      }

      // Convert to canvas coordinates
      const canvasOrigin = transformState.screenToCanvas({ x: 0, y: 0 })
      const canvasWithDelta = transformState.screenToCanvas(mouseDelta)
      const canvasDelta = {
        x: canvasWithDelta.x - canvasOrigin.x,
        y: canvasWithDelta.y - canvasOrigin.y
      }
      const snappedCanvasDelta = maybeResolveAlignmentSnap(
        dragEvent,
        canvasDelta
      )

      // Calculate new position for the current node
      const newPosition = {
        x: dragStartPos.x + snappedCanvasDelta.x,
        y: dragStartPos.y + snappedCanvasDelta.y
      }

      // Move drag updates in one transaction to avoid per-node notify fan-out.
      const updates = [{ nodeId, position: newPosition }]

      // Include other selected nodes so multi-drag stays in lockstep.
      if (
        otherSelectedNodesStartPositions &&
        otherSelectedNodesStartPositions.size > 0
      ) {
        for (const [
          otherNodeId,
          startPos
        ] of otherSelectedNodesStartPositions) {
          const newOtherPosition = {
            x: startPos.x + snappedCanvasDelta.x,
            y: startPos.y + snappedCanvasDelta.y
          }
          updates.push({ nodeId: otherNodeId, position: newOtherPosition })
        }
      }

      mutations.batchMoveNodes(updates)

      // Move selected groups using frame delta (difference from last frame)
      // This matches LiteGraph's behavior which uses delta-based movement
      if (selectedGroups && selectedGroups.length > 0 && lastCanvasDelta) {
        const frameDelta = {
          x: snappedCanvasDelta.x - lastCanvasDelta.x,
          y: snappedCanvasDelta.y - lastCanvasDelta.y
        }

        for (const group of selectedGroups) {
          group.move(frameDelta.x, frameDelta.y, true)
        }
      }

      lastCanvasDelta = snappedCanvasDelta
    })
  }

  function endDrag(event: PointerEvent, nodeId: NodeId | undefined) {
    // Apply snap to final position if snap was active (matches LiteGraph behavior)
    if (shouldSnapToGrid(event) && nodeId) {
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

    cleanupDrag()
  }

  function cancelDrag() {
    cleanupDrag()
  }

  return {
    startDrag,
    handleDrag,
    endDrag,
    cancelDrag
  }

  function maybeResolveAlignmentSnap(
    event: PointerEvent,
    canvasDelta: Point
  ): Point {
    if (!settingStore.get('Comfy.Canvas.AlignNodesWhileDragging')) {
      updateDragSnapGuides([])
      return canvasDelta
    }

    const isGridSnapActive = shouldSnapToGrid(event)
    if (
      isGridSnapActive ||
      !draggedSelectionBounds ||
      !draggedSelectionNodeIds
    ) {
      updateDragSnapGuides([])
      return canvasDelta
    }

    const translatedSelectionBounds = translateBounds(
      draggedSelectionBounds,
      canvasDelta
    )
    const searchRadius = SNAP_SEARCH_RADIUS_PX / transformState.camera.z
    const candidateBounds = getNearbyAlignmentCandidateBounds(
      translatedSelectionBounds,
      draggedSelectionNodeIds,
      searchRadius
    )

    const snapResult: NodeAlignmentSnapResult = resolveNodeAlignmentSnap({
      selectionBounds: draggedSelectionBounds,
      candidateBounds,
      delta: canvasDelta,
      zoomScale: transformState.camera.z
    })

    updateDragSnapGuides(snapResult.guides)
    return snapResult.delta
  }

  function getDraggedSelectionBounds(nodeIds: Set<NodeId>): Bounds | null {
    const bounds = Array.from(nodeIds)
      .map((id) => layoutStore.getNodeLayoutRef(id).value)
      .filter((layout): layout is NonNullable<typeof layout> => layout !== null)
      .map(getRenderedNodeBounds)

    return mergeBounds(bounds)
  }

  function getNearbyAlignmentCandidateBounds(
    translatedSelectionBounds: Bounds,
    selectedNodeSet: Set<NodeId>,
    searchRadius: number
  ): Bounds[] {
    const candidateIds = layoutStore.queryNodesInBounds(
      expandBounds(translatedSelectionBounds, searchRadius)
    )
    const candidates: Bounds[] = []

    for (const nodeId of candidateIds) {
      if (selectedNodeSet.has(nodeId)) {
        continue
      }

      const layout = layoutStore.getNodeLayoutRef(nodeId).value
      if (!layout) {
        continue
      }

      candidates.push(getRenderedNodeBounds(layout))
    }

    return candidates
  }

  function updateDragSnapGuides(guides: NodeAlignmentGuide[]) {
    if (!guides.length && !layoutStore.vueDragSnapGuides.value.length) {
      return
    }

    layoutStore.vueDragSnapGuides.value = guides
    canvasStore.canvas?.setDirty(true)
  }

  function cleanupDrag() {
    dragStartPos = null
    dragStartMouse = null
    otherSelectedNodesStartPositions = null
    pendingDragEvent = null
    selectedGroups = null
    lastCanvasDelta = null
    draggedSelectionBounds = null
    draggedSelectionNodeIds = null
    updateDragSnapGuides([])

    stopShiftSync?.()
    stopShiftSync = null

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }
}

function getRenderedNodeBounds(layout: {
  position: Point
  size: { width: number; height: number }
}): Bounds {
  const titleHeight = LiteGraph.NODE_TITLE_HEIGHT || 0

  return {
    x: layout.position.x,
    y: layout.position.y - titleHeight,
    width: layout.size.width,
    height: layout.size.height + titleHeight
  }
}

function mergeBounds(boundsList: Bounds[]): Bounds | null {
  const [firstBounds, ...remainingBounds] = boundsList
  if (!firstBounds) {
    return null
  }

  let left = firstBounds.x
  let top = firstBounds.y
  let right = firstBounds.x + firstBounds.width
  let bottom = firstBounds.y + firstBounds.height

  for (const bounds of remainingBounds) {
    left = Math.min(left, bounds.x)
    top = Math.min(top, bounds.y)
    right = Math.max(right, bounds.x + bounds.width)
    bottom = Math.max(bottom, bounds.y + bounds.height)
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  }
}

function expandBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2
  }
}
