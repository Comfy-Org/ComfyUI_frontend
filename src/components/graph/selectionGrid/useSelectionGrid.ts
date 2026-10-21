import { computed } from 'vue'

import {
  computeTidyLayout,
  tidyGapOf
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  BoxPosition,
  LayoutBox
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { Rect } from '@/lib/litegraph/src/interfaces'
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

export function useSelectionGrid() {
  const { selectedNodes } = useSelectionState()
  const mutations = useLayoutMutations(LayoutSource.Canvas)
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()

  const gridNodes = computed(() =>
    selectedNodes.value.filter((node) => !node.pinned)
  )
  const canTidy = computed(() => gridNodes.value.length >= 2)

  const measure = (): LayoutBox[] =>
    gridNodes.value.map((node) =>
      measureDrawnBox(node, canvasStore.canvas?.ctx)
    )

  const moveBoxes = (
    positions: BoxPosition[],
    { captureUndo }: { captureUndo: boolean }
  ) => {
    const { rootGraphId } = canvasStore
    if (!rootGraphId || positions.length === 0) return
    const nodesById = new Map(gridNodes.value.map((node) => [node.id, node]))
    const updates = positions.flatMap(({ id, x, y }) => {
      const node = nodesById.get(id)
      if (!node) return []
      const drawn = measureDrawnBox(node, canvasStore.canvas?.ctx)
      return [
        {
          nodeId: id,
          position: {
            x: x + node.pos[0] - drawn.x,
            y: y + node.pos[1] - drawn.y
          }
        }
      ]
    })

    mutations.batchMoveNodes(rootGraphId, updates)
    canvasStore.canvas?.setDirty(true, true)
    if (captureUndo) {
      workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
    }
  }

  const tidyUp = ({
    gap,
    captureUndo = true
  }: { gap?: number; captureUndo?: boolean } = {}): number => {
    const boxes = measure()
    const tidyGap = gap ?? tidyGapOf(boxes)
    moveBoxes(computeTidyLayout(boxes, tidyGap), { captureUndo })
    return tidyGap
  }

  return { gridNodes, canTidy, measure, moveBoxes, tidyUp }
}
