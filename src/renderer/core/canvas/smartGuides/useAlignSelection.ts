import { computed } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  arrangePlacements,
  boxesOf,
  lanesAlong
} from '@comfyorg/graph-model/arrange/arrange'
import type { AlignAction, Axis } from '@comfyorg/graph-model/arrange/arrange'
import { placementsOf } from '@/lib/litegraph/src/utils/arrange'
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

function isMatchSize(action: AlignAction) {
  return action === 'matchWidth' || action === 'matchHeight'
}

function isResizable(node: LGraphNode) {
  return !node.flags.collapsed && node.resizable !== false
}

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

    const before = placementsOf(nodes)
    const after = arrangePlacements(before, action)
    mutations.batchMoveNodes(
      rootGraphId,
      [...after].flatMap(([nodeId, { position }]) => {
        const was = before.get(nodeId)?.position
        return was?.x === position.x && was.y === position.y
          ? []
          : [{ nodeId, position }]
      })
    )
    for (const node of nodes) {
      const box = after.get(node.id)?.box
      const was = before.get(node.id)?.box
      if (!box || (box.width === was?.width && box.height === was.height))
        continue
      node.setSize([box.width, box.height - box.titleHeight])
    }
    canvas.setDirty(true, true)
    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()

    const axis = DISTRIBUTE_AXIS[action]
    distributeSession.value =
      axis && canvas.graph
        ? {
            graph: canvas.graph,
            axis,
            lanes: lanesAlong(boxesOf(after), axis),
            selectionSize: canvas.selectedItems.size
          }
        : null
  }

  return { align, canAlign }
}
