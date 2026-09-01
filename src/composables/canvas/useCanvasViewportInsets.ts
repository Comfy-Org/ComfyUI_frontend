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
    const panelMissing = panel.width.value === 0 && panel.height.value === 0
    if (panelMissing) return { left: 0, right: 0, top: 0, bottom: 0 }

    return {
      left: Math.max(0, panel.left.value - canvas.left.value),
      right: Math.max(0, canvas.right.value - panel.right.value),
      top: Math.max(0, panel.top.value - canvas.top.value),
      bottom: Math.max(0, canvas.bottom.value - panel.bottom.value)
    }
  })
}
