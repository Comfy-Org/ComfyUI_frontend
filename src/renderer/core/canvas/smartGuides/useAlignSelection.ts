import { computed } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  alignBoxes,
  lanesAlong,
  nodePlacement,
  positionForBox
} from '@/renderer/core/layout/arrange/arrange'
import type { AlignAction, Axis } from '@/renderer/core/layout/arrange/arrange'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { distributeSession } from '@/renderer/core/canvas/smartGuides/smartGuidesState'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'

const DISTRIBUTE_AXIS: Partial<Record<AlignAction, Axis>> = {
  distributeX: 'x',
  distributeY: 'y'
}

const isMatchSize = (action: AlignAction) =>
  action === 'matchWidth' || action === 'matchHeight'

const isResizable = (node: LGraphNode) =>
  !node.flags.collapsed && node.resizable !== false

export function useAlignSelection() {
  const { selectedNodes } = useSelectionState()
  const mutations = useLayoutMutations(LayoutSource.Canvas)
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()

  const movableNodes = computed(() =>
    selectedNodes.value.filter((node) => !node.pinned)
  )
  const resizableNodes = computed(() => movableNodes.value.filter(isResizable))

  function nodesFor(action: AlignAction) {
    return isMatchSize(action) ? resizableNodes.value : movableNodes.value
  }

  function canAlign(action: AlignAction) {
    if (canvasStore.isReadOnly) return false
    return nodesFor(action).length >= (DISTRIBUTE_AXIS[action] ? 3 : 2)
  }

  function align(action: AlignAction) {
    const { rootGraphId, canvas } = canvasStore
    const nodes = nodesFor(action)
    if (!rootGraphId || !canvas || !canAlign(action)) return

    const placements = nodes.map(nodePlacement)
    const before = placements.map(({ box }) => box)
    const after = alignBoxes(before, action)
    mutations.batchMoveNodes(
      rootGraphId,
      placements.flatMap((placement, i) =>
        after[i].x === before[i].x && after[i].y === before[i].y
          ? []
          : [
              {
                nodeId: placement.node.id,
                position: positionForBox(placement, after[i])
              }
            ]
      )
    )
    nodes.forEach((node, i) => {
      const { width, height, titleHeight } = after[i]
      if (width === before[i].width && height === before[i].height) return
      node.setSize([width, height - titleHeight])
    })
    canvas.setDirty(true, true)
    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()

    const axis = DISTRIBUTE_AXIS[action]
    distributeSession.value =
      axis && canvas.graph
        ? {
            graph: canvas.graph,
            axis,
            lanes: lanesAlong(after, axis).map((lane) =>
              lane.map((index) => nodes[index].id)
            ),
            selectionSize: canvas.selectedItems.size
          }
        : null
  }

  return { align, canAlign }
}
