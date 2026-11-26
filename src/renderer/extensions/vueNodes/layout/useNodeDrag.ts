import { createSharedComposable, tryOnScopeDispose } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { toValue } from 'vue'

import type { Positionable } from '@comfyorg/graph-model/interfaces'
import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { AutoPanController } from '@/renderer/core/canvas/useAutoPan'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeBoundsUpdate } from '@comfyorg/graph-model/layout'
import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { useNodeSnap } from '@/renderer/extensions/vueNodes/composables/useNodeSnap'
import { useShiftKeySync } from '@/renderer/extensions/vueNodes/composables/useShiftKeySync'
import { isLGraphNode } from '@/utils/litegraphUtil'

export const useNodeDrag = createSharedComposable(() => {
  const mutations = useLayoutMutations(LayoutSource.Vue)
  const { selectedNodeIds, selectedItems } = storeToRefs(useCanvasStore())

  const { shouldSnap, applySnapToPosition } = useNodeSnap()

  const { trackShiftKey } = useShiftKeySync()

  const canvasStore = useCanvasStore()

  let dragStartPos: Point | null = null
  let dragStartMouse: Point | null = null
  let otherSelectedNodesStartPositions: Map<NodeId, Point> | null = null
  let stopFrame: (() => void) | null = null
  let stopShiftSync: (() => void) | null = null

  let nonNodeStartPositions: Map<Positionable, Point> | null = null

  let autoPan: AutoPanController | null = null
  let lastPointerX = 0
  let lastPointerY = 0

  function startDrag(
    event: PointerEvent,
    nodeId: NodeId,
    initialShiftKey: boolean
  ) {
    const { rootGraphId } = canvasStore
    if (!rootGraphId) return

    const layout = layoutStore.getNodeLayout(rootGraphId, nodeId)
    if (!layout) return
    const position = layout.position

    stopShiftSync = trackShiftKey(initialShiftKey)

    dragStartPos = { ...position }
    dragStartMouse = { x: event.clientX, y: event.clientY }
    lastPointerX = event.clientX
    lastPointerY = event.clientY

    const selectedNodes = toValue(selectedNodeIds)

    const isDraggedNodeInSelection = selectedNodes.has(nodeId)

    if (isDraggedNodeInSelection && selectedNodes.size > 1) {
      otherSelectedNodesStartPositions = new Map()

      for (const id of selectedNodes) {
        if (id === nodeId) continue

        const nodeLayout = layoutStore.getNodeLayout(rootGraphId, id)
        if (nodeLayout) {
          otherSelectedNodesStartPositions.set(id, { ...nodeLayout.position })
        }
      }
    } else {
      otherSelectedNodesStartPositions = null
    }

    nonNodeStartPositions = isDraggedNodeInSelection
      ? new Map(
          toValue(selectedItems)
            .filter((item) => !isLGraphNode(item))
            .map((item) => [item, { x: item.pos[0], y: item.pos[1] }])
        )
      : null
  }

  function startAutoPan(event: PointerEvent, nodeId: NodeId) {
    if (autoPan) {
      autoPan.updatePointer(event.clientX, event.clientY)
      return
    }
    const lgCanvas = canvasStore.canvas
    if (!lgCanvas?.ds) return

    autoPan = new AutoPanController({
      canvas: lgCanvas,
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
        if (nonNodeStartPositions) {
          for (const start of nonNodeStartPositions.values()) {
            start.x += panX
            start.y += panY
          }
        }
        updateNodePositions(nodeId)
      }
    })
    autoPan.updatePointer(event.clientX, event.clientY)
    autoPan.start()
  }

  function updateNodePositions(nodeId: NodeId) {
    stopFrame?.()
    stopFrame = null
    if (!dragStartPos || !dragStartMouse) return

    const { rootGraphId, canvas } = canvasStore
    if (!rootGraphId || !canvas || canvasStore.isReadOnly) return

    const canvasDelta = {
      x: (lastPointerX - dragStartMouse.x) / canvas.ds.scale,
      y: (lastPointerY - dragStartMouse.y) / canvas.ds.scale
    }

    const updates = [
      {
        nodeId,
        position: {
          x: dragStartPos.x + canvasDelta.x,
          y: dragStartPos.y + canvasDelta.y
        }
      }
    ]

    if (
      otherSelectedNodesStartPositions &&
      otherSelectedNodesStartPositions.size > 0
    ) {
      for (const [otherNodeId, startPos] of otherSelectedNodesStartPositions) {
        updates.push({
          nodeId: otherNodeId,
          position: {
            x: startPos.x + canvasDelta.x,
            y: startPos.y + canvasDelta.y
          }
        })
      }
    }

    mutations.batchMoveNodes(rootGraphId, updates)

    for (const [item, start] of nonNodeStartPositions ?? []) {
      item.move(
        start.x + canvasDelta.x - item.pos[0],
        start.y + canvasDelta.y - item.pos[1],
        true
      )
    }
  }

  function handleDrag(event: PointerEvent, nodeId: NodeId) {
    if (!dragStartPos || !dragStartMouse) {
      return
    }
    if (canvasStore.isReadOnly) {
      autoPan?.stop()
      const canvas = canvasStore.getCanvas()
      const delta = [event.clientX - lastPointerX, event.clientY - lastPointerY]

      canvas.ds.offset[0] += delta[0] / canvas.ds.scale
      canvas.ds.offset[1] += delta[1] / canvas.ds.scale
      canvas.setDirty(true, true)
      lastPointerX = event.clientX
      lastPointerY = event.clientY
      dragStartMouse.x += delta[0]
      dragStartMouse.y += delta[1]
      return
    }

    lastPointerX = event.clientX
    lastPointerY = event.clientY
    startAutoPan(event, nodeId)

    const { canvas } = canvasStore
    if (stopFrame || !canvas) return
    stopFrame = onCanvasFrame(canvas, 'update', () =>
      updateNodePositions(nodeId)
    )
  }

  function endDrag(event: PointerEvent, nodeId: NodeId | undefined) {
    if (nodeId && stopFrame) updateNodePositions(nodeId)
    const { rootGraphId } = canvasStore
    if (shouldSnap(event) && nodeId && rootGraphId) {
      const boundsUpdates: NodeBoundsUpdate[] = []

      const currentLayout = layoutStore.getNodeLayout(rootGraphId, nodeId)
      if (currentLayout) {
        const currentPos = currentLayout.position
        const snappedPos = applySnapToPosition({ ...currentPos })

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

      if (
        otherSelectedNodesStartPositions &&
        otherSelectedNodesStartPositions.size > 0
      ) {
        for (const otherNodeId of otherSelectedNodesStartPositions.keys()) {
          const nodeLayout = layoutStore.getNodeLayout(rootGraphId, otherNodeId)
          if (nodeLayout) {
            const currentPos = { ...nodeLayout.position }
            const snappedPos = applySnapToPosition(currentPos)

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

      if (boundsUpdates.length > 0) {
        layoutStore.batchUpdateNodeBounds(rootGraphId, boundsUpdates, {
          source: LayoutSource.Vue
        })
      }
    }

    resetDragState()
  }

  function resetDragState() {
    dragStartPos = null
    dragStartMouse = null
    otherSelectedNodesStartPositions = null
    nonNodeStartPositions = null

    autoPan?.stop()
    autoPan = null

    stopShiftSync?.()
    stopShiftSync = null

    stopFrame?.()
    stopFrame = null
  }

  tryOnScopeDispose(resetDragState)

  return {
    startDrag,
    handleDrag,
    endDrag,
    cancelDrag: resetDragState
  }
})
