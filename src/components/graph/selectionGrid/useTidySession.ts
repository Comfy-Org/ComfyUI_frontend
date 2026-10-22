import { tryOnScopeDispose } from '@vueuse/core'
import { readonly, ref } from 'vue'

import {
  DEFAULT_TIDY_GAP,
  tidiedGapOf
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type { GapBar } from '@/components/graph/selectionGrid/selectionGridLayout'
import { useGapDragSession } from '@/components/graph/selectionGrid/useGapDragSession'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export function useTidySession() {
  const { gridNodes, measure, tidyUp, recordUndoStep } = useSelectionGrid()
  const workflowStore = useWorkflowStore()
  const handles = useGapDragSession()

  const gap = ref(DEFAULT_TIDY_GAP)
  const hasMixedGaps = ref(false)
  let nodes: LGraphNode[] = []
  let finishPreview: (() => void) | undefined
  let pendingFrame: number | null = null

  const dropPendingPreview = () => {
    if (pendingFrame === null) return
    cancelAnimationFrame(pendingFrame)
    pendingFrame = null
  }

  const applyGap = (nextGap: number) => {
    tidyUp(nodes, { gap: nextGap, captureUndo: false })
  }

  const start = () => {
    finish()
    hasMixedGaps.value = false
    nodes = [...gridNodes.value]
    gap.value = tidyUp(nodes)
  }

  const previewGap = (nextGap: number) => {
    if (handles.drag.value) return
    hasMixedGaps.value = false
    finishPreview ??=
      workflowStore.activeWorkflow?.changeTracker.beginPreview(finish) ??
      recordUndoStep
    gap.value = nextGap
    dropPendingPreview()
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      applyGap(nextGap)
    })
  }

  const commitGap = (nextGap: number) => {
    if (handles.drag.value) return
    hasMixedGaps.value = false
    dropPendingPreview()
    gap.value = nextGap
    applyGap(nextGap)
    const settle = finishPreview ?? recordUndoStep
    finishPreview = undefined
    settle()
  }

  const showLaidOutGap = () => {
    const laidOutGap = tidiedGapOf(measure())
    hasMixedGaps.value = laidOutGap === undefined
    if (laidOutGap !== undefined) gap.value = laidOutGap
  }

  const finish = () => {
    if (finishPreview) commitGap(gap.value)
    else dropPendingPreview()
  }

  tryOnScopeDispose(finish)

  return {
    gap: readonly(gap),
    hasMixedGaps: readonly(hasMixedGaps),
    start,
    previewGap,
    commitGap,
    finish,
    handles: {
      ...handles,
      start(bar: GapBar) {
        finish()
        handles.start(bar)
      },
      commit() {
        handles.commit()
        showLaidOutGap()
      },
      nudge(bar: GapBar, step: number) {
        finish()
        handles.nudge(bar, step)
      },
      commitNudges() {
        if (handles.commitNudges()) showLaidOutGap()
      }
    }
  }
}
