import { tryOnScopeDispose } from '@vueuse/core'
import { readonly, ref } from 'vue'

import { DEFAULT_TIDY_GAP } from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'

export function useTidySession() {
  const { tidyUp } = useSelectionGrid()

  const gap = ref(DEFAULT_TIDY_GAP)
  let committedGap = DEFAULT_TIDY_GAP
  let pendingFrame: number | null = null

  const dropPendingPreview = () => {
    if (pendingFrame === null) return
    cancelAnimationFrame(pendingFrame)
    pendingFrame = null
  }

  const start = () => {
    dropPendingPreview()
    committedGap = tidyUp()
    gap.value = committedGap
  }

  const previewGap = (nextGap: number) => {
    gap.value = nextGap
    dropPendingPreview()
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      tidyUp({ gap: nextGap, captureUndo: false })
    })
  }

  const commitGap = (nextGap: number) => {
    dropPendingPreview()
    committedGap = nextGap
    gap.value = nextGap
    tidyUp({ gap: nextGap, captureUndo: true })
  }

  const finish = () => {
    if (gap.value === committedGap) dropPendingPreview()
    else commitGap(gap.value)
  }

  tryOnScopeDispose(dropPendingPreview)

  return { gap: readonly(gap), start, previewGap, commitGap, finish }
}
