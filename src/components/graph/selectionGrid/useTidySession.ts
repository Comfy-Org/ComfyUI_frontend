import { tryOnScopeDispose } from '@vueuse/core'
import { readonly, ref } from 'vue'

import { DEFAULT_TIDY_GAP } from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export function useTidySession() {
  const { gridNodes, tidyUp, recordUndoStep } = useSelectionGrid()
  const workflowStore = useWorkflowStore()

  const gap = ref(DEFAULT_TIDY_GAP)
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
    nodes = [...gridNodes.value]
    gap.value = tidyUp(nodes)
  }

  const previewGap = (nextGap: number) => {
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
    dropPendingPreview()
    gap.value = nextGap
    applyGap(nextGap)
    const settle = finishPreview ?? recordUndoStep
    finishPreview = undefined
    settle()
  }

  const adoptGap = (laidOutGap: number) => {
    dropPendingPreview()
    const settle = finishPreview
    finishPreview = undefined
    settle?.()
    gap.value = laidOutGap
  }

  const finish = () => {
    if (finishPreview) commitGap(gap.value)
    else dropPendingPreview()
  }

  tryOnScopeDispose(finish)

  return {
    gap: readonly(gap),
    start,
    previewGap,
    commitGap,
    adoptGap,
    finish
  }
}
