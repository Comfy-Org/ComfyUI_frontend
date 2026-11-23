import { useDevicePixelRatio, useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch, watchEffect } from 'vue'
import type { Ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

const HYSTERESIS = 0.15

/** Zoom below which node text stops being legible. */
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

  const threshold = computed(() =>
    getLowQualityThreshold(
      settingStore.get('LiteGraph.Canvas.MinFontSizeForLOD'),
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

    isLowQuality.value = isLowQuality.value
      ? camera.z < limit * (1 + HYSTERESIS)
      : camera.z < limit
  })

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
