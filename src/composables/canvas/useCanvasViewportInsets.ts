import { useElementBounding } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import type { ViewportInsets } from '@/lib/litegraph/src/DragAndScale'

/**
 * Reactive insets representing the area of `#graph-canvas` obscured by the
 * `.graph-canvas-panel` overlay (sidebar, right panel, etc.) on each side.
 *
 * Backed by VueUse's `useElementBounding`, which uses passive observers and
 * caches reads.
 */
export function useCanvasViewportInsets(): ComputedRef<ViewportInsets> {
  const canvas = useElementBounding(() =>
    document.getElementById('graph-canvas')
  )
  const panel = useElementBounding(() =>
    document.querySelector<HTMLElement>('.graph-canvas-panel')
  )

  return computed<ViewportInsets>(() => {
    const overlapsHorizontally =
      panel.right.value > canvas.left.value &&
      panel.left.value < canvas.right.value

    return {
      left: overlapsHorizontally
        ? Math.max(0, panel.left.value - canvas.left.value)
        : 0,
      right: overlapsHorizontally
        ? Math.max(0, canvas.right.value - panel.right.value)
        : 0
    }
  })
}
