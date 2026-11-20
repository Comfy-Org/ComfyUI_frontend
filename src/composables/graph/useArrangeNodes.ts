import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { placementsOf } from '@/lib/litegraph/src/utils/arrange'
import { stackPlacements } from '@comfyorg/graph-model/arrange/arrange'
import type { StackLayout } from '@comfyorg/graph-model/arrange/arrange'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { useApp } from '@/scripts/appInstance'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

export const DEFAULT_ARRANGE_GAP = 12
export const MIN_ARRANGE_GAP = 0
export const MAX_ARRANGE_GAP = 48

interface ArrangeUpdate {
  nodeId: NodeId
  position: Point
}

export function computeArrangement(
  nodes: LGraphNode[],
  layout: StackLayout,
  gap: number = DEFAULT_ARRANGE_GAP
): ArrangeUpdate[] {
  return [...stackPlacements(placementsOf(nodes), layout, gap)].map(
    ([nodeId, { position }]) => ({ nodeId, position })
  )
}

interface ArrangeOptions {
  gap?: number
  captureUndo?: boolean
}

export function useArrangeNodes() {
  const { selectedNodes, hasMultipleSelection } = useSelectionState()
  const mutations = useLayoutMutations(LayoutSource.Canvas)
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()

  const arrangeNodes = (
    layout: StackLayout,
    { gap = DEFAULT_ARRANGE_GAP, captureUndo = true }: ArrangeOptions = {}
  ) => {
    if (!hasMultipleSelection.value) return
    const { rootGraphId } = canvasStore
    if (!rootGraphId) return

    const updates = computeArrangement(selectedNodes.value, layout, gap)
    if (updates.length === 0) return

    mutations.batchMoveNodes(rootGraphId, updates)
    useApp().canvas.setDirty(true, true)
    if (captureUndo) {
      workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
    }
  }

  return { arrangeNodes, canArrange: hasMultipleSelection }
}
