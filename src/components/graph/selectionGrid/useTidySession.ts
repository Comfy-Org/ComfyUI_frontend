import { tryOnScopeDispose } from '@vueuse/core'
import { readonly, ref } from 'vue'

import { DEFAULT_TIDY_GAP } from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

export function useTidySession() {
  const { gridNodes, tidyUp, recordUndoStep } = useSelectionGrid()

  const gap = ref(DEFAULT_TIDY_GAP)
  let nodes: LGraphNode[] = []
  let committedGap = DEFAULT_TIDY_GAP
  let appliedGap = DEFAULT_TIDY_GAP
  let pendingFrame: number | null = null

  const dropPendingPreview = () => {
    if (pendingFrame === null) return
    cancelAnimationFrame(pendingFrame)
    pendingFrame = null
  }

  const applyGap = (nextGap: number) => {
    tidyUp(nodes, { gap: nextGap, captureUndo: false })
    appliedGap = nextGap
  }

  const start = () => {
    dropPendingPreview()
    nodes = [...gridNodes.value]
    committedGap = tidyUp(nodes)
    appliedGap = committedGap
    gap.value = committedGap
  }

  const previewGap = (nextGap: number) => {
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
    committedGap = nextGap
    recordUndoStep()
  }

  const adoptGap = (laidOutGap: number) => {
    dropPendingPreview()
    gap.value = laidOutGap
    committedGap = laidOutGap
    appliedGap = laidOutGap
  }

  const finish = () => {
    const isSettled = gap.value === committedGap && appliedGap === committedGap
    if (isSettled) dropPendingPreview()
    else commitGap(gap.value)
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
