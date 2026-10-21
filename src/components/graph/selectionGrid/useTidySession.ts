import { tryOnScopeDispose } from '@vueuse/core'
import { readonly, ref } from 'vue'

import { DEFAULT_TIDY_GAP } from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

export function useTidySession() {
  const { gridNodes, tidyUp, recordUndoStep } = useSelectionGrid()

  const gap = ref(DEFAULT_TIDY_GAP)
  let nodes: LGraphNode[] = []
  let hasUncommittedPreview = false
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
    dropPendingPreview()
    hasUncommittedPreview = false
    nodes = [...gridNodes.value]
    gap.value = tidyUp(nodes)
  }

  const previewGap = (nextGap: number) => {
    gap.value = nextGap
    hasUncommittedPreview = true
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
    hasUncommittedPreview = false
    recordUndoStep()
  }

  const adoptGap = (laidOutGap: number) => {
    dropPendingPreview()
    hasUncommittedPreview = false
    gap.value = laidOutGap
  }

  const finish = () => {
    if (hasUncommittedPreview) commitGap(gap.value)
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
