import { readonly, ref } from 'vue'

import {
  DEFAULT_ARRANGE_GAP,
  useArrangeNodes
} from '@/composables/graph/useArrangeNodes'
import type { ArrangeLayout } from '@/composables/graph/useArrangeNodes'

export function useArrangeSession() {
  const { arrangeNodes } = useArrangeNodes()

  const activeLayout = ref<ArrangeLayout | null>(null)
  const gap = ref(DEFAULT_ARRANGE_GAP)
  let pendingFrame: number | null = null

  const cancelPendingFrame = () => {
    if (pendingFrame === null) return
    cancelAnimationFrame(pendingFrame)
    pendingFrame = null
  }

  const reset = () => {
    cancelPendingFrame()
    activeLayout.value = null
    gap.value = DEFAULT_ARRANGE_GAP
  }

  const start = (layout: ArrangeLayout) => {
    gap.value = DEFAULT_ARRANGE_GAP
    activeLayout.value = layout
    arrangeNodes(layout, { gap: gap.value, captureUndo: true })
  }

  const previewGap = (nextGap: number) => {
    if (activeLayout.value === null) return
    gap.value = nextGap
    cancelPendingFrame()
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      if (activeLayout.value === null) return
      arrangeNodes(activeLayout.value, { gap: nextGap, captureUndo: false })
    })
  }

  const commitGap = (nextGap: number) => {
    if (activeLayout.value === null) return
    cancelPendingFrame()
    gap.value = nextGap
    arrangeNodes(activeLayout.value, { gap: nextGap, captureUndo: true })
  }

  return {
    activeLayout: readonly(activeLayout),
    gap: readonly(gap),
    start,
    previewGap,
    commitGap,
    reset
  }
}
