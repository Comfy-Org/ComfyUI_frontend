import { onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'

import { clamp } from 'es-toolkit'

import { denormalize, normalize } from '@/utils/mathUtil'
import type { RangeValue } from '@/lib/litegraph/src/types/widgets'

type HandleType = 'min' | 'max' | 'midpoint'

interface UseRangeEditorOptions {
  trackRef: Ref<HTMLElement | null>
  modelValue: Ref<RangeValue>
  valueMin: Ref<number>
  valueMax: Ref<number>
  showMidpoint: Ref<boolean>
}

export function useRangeEditor({
  trackRef,
  modelValue,
  valueMin,
  valueMax,
  showMidpoint
}: UseRangeEditorOptions) {
  const activeHandle = ref<HandleType | null>(null)
  let cleanupDrag: (() => void) | null = null

  function pointerToValue(e: PointerEvent): number {
    const el = trackRef.value
    if (!el) return valueMin.value
    const rect = el.getBoundingClientRect()
    const normalized = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    return denormalize(normalized, valueMin.value, valueMax.value)
  }

  function nearestHandle(value: number): HandleType {
    const { min, max, midpoint } = modelValue.value
    const dMin = Math.abs(value - min)
    const dMax = Math.abs(value - max)
    let best: HandleType = dMin <= dMax ? 'min' : 'max'
    const bestDist = Math.min(dMin, dMax)
    if (midpoint !== undefined && showMidpoint.value) {
      const midAbs = min + midpoint * (max - min)
      if (Math.abs(value - midAbs) < bestDist) {
        best = 'midpoint'
      }
    }
    return best
  }

  function updateValue(handle: HandleType, value: number) {
    const current = modelValue.value
    const clamped = clamp(value, valueMin.value, valueMax.value)

    if (handle === 'min') {
      modelValue.value = { ...current, min: Math.min(clamped, current.max) }
    } else if (handle === 'max') {
      modelValue.value = { ...current, max: Math.max(clamped, current.min) }
    } else {
      const range = current.max - current.min
      const midNorm =
        range > 0 ? normalize(clamped, current.min, current.max) : 0
      const midpoint = clamp(midNorm, 0, 1)
      modelValue.value = { ...current, midpoint }
    }
  }

  function handleTrackPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    startDrag(nearestHandle(pointerToValue(e)), e)
  }

  function startDrag(handle: HandleType, e: PointerEvent) {
    if (e.button !== 0) return
    cleanupDrag?.()

    activeHandle.value = handle
    const el = trackRef.value
    if (!el) return

    el.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      if (!activeHandle.value) return
      updateValue(activeHandle.value, pointerToValue(ev))
    }

    const endDrag = () => {
      if (!activeHandle.value) return
      activeHandle.value = null
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('lostpointercapture', endDrag)
      cleanupDrag = null
    }

    cleanupDrag = endDrag

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('lostpointercapture', endDrag)
  }

  onBeforeUnmount(() => {
    cleanupDrag?.()
  })

  return {
    handleTrackPointerDown,
    startDrag
  }
}
