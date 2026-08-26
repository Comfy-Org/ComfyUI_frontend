/**
 * Level-of-detail switch for Vue node rendering.
 *
 * Uses the threshold calculation and setting from litegraph's low-quality
 * pass. Vue adds hysteresis because switching modes mounts or detaches the
 * full node set rather than changing how an existing canvas pass is painted.
 */
import { useDevicePixelRatio, useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch, watchEffect } from 'vue'
import type { Ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

/**
 * Fraction of the threshold the zoom must travel back through before the
 * switch flips again.
 *
 * Crossing swaps the entire node set - thousands of elements - rather than the
 * handful at a spatial boundary, and wheel zoom is continuous, so a gesture
 * that dwells on the threshold or reverses at it would otherwise mount and
 * unmount the whole graph repeatedly.
 */
const HYSTERESIS = 0.15

/**
 * Zoom below which node text stops being legible.
 *
 * Higher-DPI displays keep small text readable for longer, but not linearly,
 * so litegraph approximates the gain with a square root - matched here.
 */
export function getLowQualityThreshold(
  minFontSize: number,
  devicePixelRatio = window.devicePixelRatio || 1
): number {
  if (minFontSize <= 0) return 0

  const dprAdjustment = Math.sqrt(devicePixelRatio)
  return minFontSize / (LiteGraph.NODE_TEXT_SIZE * dprAdjustment)
}

export function useLowQualityRendering(canvas: Ref<LGraphCanvas | undefined>) {
  const { camera } = useTransformState()
  const { pixelRatio } = useDevicePixelRatio()
  const devicePixelRatio = ref(pixelRatio.value)
  const settingStore = useSettingStore()

  watch(pixelRatio, (value) => (devicePixelRatio.value = value))
  useEventListener(window, 'resize', () => {
    devicePixelRatio.value = window.devicePixelRatio || 1
  })

  // Read from the setting rather than the canvas instance: the instance field
  // is a plain getter, so a settings change would not re-evaluate this until
  // something else moved the camera.
  const threshold = computed(() =>
    getLowQualityThreshold(
      settingStore.get('LiteGraph.Canvas.MinFontSizeForLOD') ??
        canvas.value?.min_font_size_for_lod ??
        0,
      devicePixelRatio.value
    )
  )

  const isLowQuality = ref(false)

  watchEffect(() => {
    const limit = threshold.value
    if (limit <= 0) {
      isLowQuality.value = false
      return
    }

    // Asymmetric bounds: drop into boxes at the threshold, but climb back out
    // only once clearly above it.
    isLowQuality.value = isLowQuality.value
      ? camera.z < limit * (1 + HYSTERESIS)
      : camera.z < limit
  })

  // Vue owns node interaction only while its components exist. Below the
  // threshold none are mounted, so litegraph has to take hit-testing back or
  // the graph becomes unselectable, undraggable and unresizable while boxes
  // are showing - with right-click still working, which is worse than either.
  watchEffect(() => {
    LiteGraph.vueNodesSuspended = isLowQuality.value
  })
  onScopeDispose(() => {
    LiteGraph.vueNodesSuspended = false
  })

  watch(
    isLowQuality,
    () => {
      canvas.value?.setDirty(true, true)
    },
    { immediate: true }
  )

  return { isLowQuality }
}
