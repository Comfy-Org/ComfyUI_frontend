import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import { clamp } from 'es-toolkit'

import { ASPECT_RATIOS } from '@/composables/useImageCrop'
import { MIN_CROP_SIZE } from '@/composables/video/useCropBoxEditor'
import type { Bounds } from '@/renderer/core/layout/types'

interface UseCropRatioLockOptions {
  sourceWidth: Ref<number>
  sourceHeight: Ref<number>
}

export function useCropRatioLock(
  bounds: Ref<Bounds>,
  options: UseCropRatioLockOptions
) {
  const { sourceWidth, sourceHeight } = options

  const lockedRatio = ref<number | null>(null)
  const ratioKeys = Object.keys(ASPECT_RATIOS)

  const canLockRatio = computed(
    () =>
      isPositiveFinite(sourceWidth.value) &&
      isPositiveFinite(sourceHeight.value) &&
      isPositiveFinite(bounds.value.width) &&
      isPositiveFinite(bounds.value.height)
  )

  function applyLockedRatio() {
    const ratio = lockedRatio.value
    if (ratio == null) return

    const sourceW = sourceWidth.value
    const sourceH = sourceHeight.value
    let { x, y } = bounds.value
    let width = bounds.value.width
    let height = width / ratio

    const scale = Math.min(
      1,
      Math.max(sourceW - x, 0) / width,
      Math.max(sourceH - y, 0) / height
    )
    width = Math.max(width * scale, MIN_CROP_SIZE, MIN_CROP_SIZE * ratio)
    height = width / ratio

    x = clamp(x, 0, Math.max(sourceW - width, 0))
    y = clamp(y, 0, Math.max(sourceH - height, 0))

    bounds.value = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Math.min(width, sourceW)),
      height: Math.round(Math.min(height, sourceH))
    }
  }

  const selectedRatio = computed({
    get: () => {
      if (lockedRatio.value == null) return 'custom'
      const entry = Object.entries(ASPECT_RATIOS).find(
        ([, value]) => value === lockedRatio.value
      )
      return entry ? entry[0] : 'custom'
    },
    set: (key: string) => {
      if (key === 'custom') {
        lockedRatio.value = null
        return
      }
      if (!canLockRatio.value) return
      lockedRatio.value =
        ASPECT_RATIOS[key as keyof typeof ASPECT_RATIOS] ?? null
      applyLockedRatio()
    }
  })

  const isLockEnabled = computed({
    get: () => lockedRatio.value != null,
    set: (locked: boolean) => {
      if (locked && lockedRatio.value == null) {
        if (!canLockRatio.value) return
        lockedRatio.value = bounds.value.width / bounds.value.height
      }
      if (!locked) {
        lockedRatio.value = null
      }
    }
  })

  return { lockedRatio, ratioKeys, selectedRatio, isLockEnabled, canLockRatio }
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0
}
