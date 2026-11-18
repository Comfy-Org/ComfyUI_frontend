import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { alignBoxes } from '@/renderer/core/canvas/smartGuides/alignBoxes'
import {
  nodePlacement,
  positionFor
} from '@/renderer/core/canvas/smartGuides/dragSnapSession'
import { orderAlong } from '@/renderer/core/canvas/smartGuides/distributeGaps'
import type { DistributeAxis } from '@/renderer/core/canvas/smartGuides/distributeGaps'
import { distributeSession } from '@/renderer/core/canvas/smartGuides/smartGuidesState'
import type { AlignAction } from '@/renderer/core/canvas/smartGuides/alignBoxes'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'

const DISTRIBUTE_AXIS: Partial<Record<AlignAction, DistributeAxis>> = {
  distributeX: 'x',
  distributeY: 'y'
}

export function useAlignSelection() {
  const { selectedNodes, hasMultipleSelection } = useSelectionState()
  const mutations = useLayoutMutations(LayoutSource.Canvas)
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()

  function align(action: AlignAction) {
    const { rootGraphId, canvas } = canvasStore
    const nodes = selectedNodes.value.filter((node) => !node.pinned)
    if (!rootGraphId || nodes.length < 2) return

    const placements = nodes.map(nodePlacement)
    const before = placements.map(({ box }) => box)
    const after = alignBoxes(before, action)
    mutations.batchMoveNodes(
      rootGraphId,
      placements.map((placement, i) => ({
        nodeId: placement.node.id,
        position: positionFor(placement, after[i])
      }))
    )
    nodes.forEach((node, i) => {
      const { width, height, head } = after[i]
      if (width === before[i].width && height === before[i].height) return
      node.setSize([width, height - head])
    })
    canvas?.setDirty(true, true)
    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()

    const axis = DISTRIBUTE_AXIS[action]
    distributeSession.value =
      axis && canvas?.graph && nodes.length >= 3
        ? {
            graph: canvas.graph,
            axis,
            nodeIds: orderAlong(after, axis).map(
              ({ index }) => nodes[index].id
            ),
            selectionSize: canvas.selectedItems.size
          }
        : null
  }

  return { align, canAlign: hasMultipleSelection }
}
