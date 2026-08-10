/**
 * Level-of-detail switch for Vue node rendering.
 *
 * Mirrors the threshold litegraph uses for its own low-quality pass
 * (`LGraphCanvas.updateLowQualityThreshold`), so both renderers simplify at
 * exactly the same zoom and the setting that controls it keeps working in
 * either mode.
 */
import { computed, watch } from 'vue'
import type { Ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

/**
 * Zoom below which node text stops being legible.
 *
 * Higher-DPI displays keep small text readable for longer, but not linearly,
 * so litegraph approximates the gain with a square root - matched here.
 */
export function getLowQualityThreshold(minFontSize: number): number {
  if (minFontSize <= 0) return 0

  const dprAdjustment = Math.sqrt(window.devicePixelRatio || 1)
  return minFontSize / (LiteGraph.NODE_TEXT_SIZE * dprAdjustment)
}

export function useLowQualityRendering(canvas: Ref<LGraphCanvas | undefined>) {
  const { camera } = useTransformState()

  const isLowQuality = computed(() => {
    const minFontSize = canvas.value?.min_font_size_for_lod ?? 0
    const threshold = getLowQualityThreshold(minFontSize)
    return threshold > 0 && camera.z < threshold
  })

  // Link rendering waits for nodes to report their slot positions from the DOM.
  // Simplified nodes have no slot elements, so that measurement never arrives
  // and links would stay hidden for as long as the view stays zoomed out -
  // which is the entire time, for a graph large enough to open below the
  // threshold. Release the wait and repaint, letting links fall back to
  // positions derived from node bounds.
  watch(
    isLowQuality,
    (lowQuality) => {
      if (lowQuality) layoutStore.setPendingSlotSync(false)
      canvas.value?.setDirty(true, true)
    },
    { immediate: true }
  )

  return { isLowQuality }
}
