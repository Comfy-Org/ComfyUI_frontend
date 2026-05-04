import { useElementBounding } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import type { ViewportInsets } from '@/lib/litegraph/src/DragAndScale'

let shared: ComputedRef<ViewportInsets> | null = null

/**
 * Reactive insets representing the area of `#graph-canvas` obscured by the
 * `.graph-canvas-panel` overlay (sidebar, right panel, etc.) on each side.
 *
 * Backed by VueUse's `useElementBounding`, which uses passive observers and
 * caches reads, so call sites pay no per-call layout cost. Singleton — the
 * underlying observers attach once for the app's lifetime.
 */
export function useCanvasViewportInsets(): ComputedRef<ViewportInsets> {
  if (shared) return shared

  const canvas = useElementBounding(() =>
    document.getElementById('graph-canvas')
  )
  const panel = useElementBounding(() =>
    document.querySelector<HTMLElement>('.graph-canvas-panel')
  )

  shared = computed<ViewportInsets>(() => ({
    left: Math.max(0, panel.left.value - canvas.left.value),
    right: Math.max(0, canvas.right.value - panel.right.value),
    top: Math.max(0, panel.top.value - canvas.top.value),
    bottom: Math.max(0, canvas.bottom.value - panel.bottom.value)
  }))

  return shared
}
