import { computed } from 'vue'

import {
  computeTidyLayout,
  detectSelectionGrid,
  tidyGapOf
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  BoxPosition,
  LayoutBox
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { Rect } from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'

function measureDrawnBox(
  node: LGraphNode,
  ctx: CanvasRenderingContext2D | undefined
): LayoutBox {
  const bounds: Rect = [0, 0, 0, 0]
  node.measure(bounds, ctx)
  node.onBounding?.(bounds)
  const [x, y, width, height] = bounds
  return { id: node.id, x, y, width, height }
}

function nodePositionForDrawnBoxAt(
  node: LGraphNode,
  { x, y }: BoxPosition,
  ctx: CanvasRenderingContext2D | undefined
) {
  const drawn = measureDrawnBox(node, ctx)
  return { x: x + node.pos[0] - drawn.x, y: y + node.pos[1] - drawn.y }
}

export function useSelectionGrid() {
  const { selectedNodes } = useSelectionState()
  const mutations = useLayoutMutations(LayoutSource.Canvas)
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()

  const gridNodes = computed(() =>
    selectedNodes.value.filter((node) => !node.pinned)
  )
  const canTidy = computed(
    () => gridNodes.value.length >= 2 && !canvasStore.isReadOnly
  )

  const isMovable = (node: LGraphNode) =>
    !node.pinned && node.graph === canvasStore.canvas?.graph

  const measure = (nodes: LGraphNode[] = gridNodes.value): LayoutBox[] =>
    nodes
      .filter(isMovable)
      .map((node) => measureDrawnBox(node, canvasStore.canvas?.ctx))

  const recordUndoStep = () => {
    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
  }

  const capturePositions = (nodes: LGraphNode[]) => {
    const graph = canvasStore.currentGraph
    const positions = nodes.map((node) => ({
      node,
      position: { x: node.pos[0], y: node.pos[1] }
    }))
    return () => {
      if (!graph) return
      const updates = positions
        .filter(({ node }) => graph.getNodeById(node.id) === node)
        .map(({ node, position }) => ({ nodeId: node.id, position }))
      mutations.batchMoveNodes(graph.rootGraph.id, updates)
      canvasStore.canvas?.setDirty(true, true)
    }
  }

  const placeBoxes = (
    nodes: LGraphNode[],
    positions: BoxPosition[]
  ): boolean => {
    const { rootGraphId } = canvasStore
    if (!rootGraphId) return false
    const nodesById = new Map(
      nodes.filter(isMovable).map((node) => [node.id, node])
    )
    const updates = positions.flatMap((position) => {
      const node = nodesById.get(position.id)
      if (!node) return []
      return [
        {
          nodeId: position.id,
          position: nodePositionForDrawnBoxAt(
            node,
            position,
            canvasStore.canvas?.ctx
          )
        }
      ]
    })

    if (updates.length === 0) return false
    mutations.batchMoveNodes(rootGraphId, updates)
    canvasStore.canvas?.setDirty(true, true)
    return true
  }

  const moveBoxes = (
    nodes: LGraphNode[],
    positions: BoxPosition[],
    { captureUndo }: { captureUndo: boolean }
  ): boolean => {
    if (canvasStore.isReadOnly || !placeBoxes(nodes, positions)) return false
    if (captureUndo) recordUndoStep()
    return true
  }

  const tidyUp = (
    nodes: LGraphNode[] = gridNodes.value,
    { gap, captureUndo = true }: { gap?: number; captureUndo?: boolean } = {}
  ): number => {
    const grid = detectSelectionGrid(measure(nodes))
    const tidyGap = gap ?? tidyGapOf(grid)
    moveBoxes(nodes, computeTidyLayout(grid, tidyGap), { captureUndo })
    return tidyGap
  }

  return {
    gridNodes,
    canTidy,
    measure,
    capturePositions,
    moveBoxes,
    recordUndoStep,
    tidyUp
  }
}
