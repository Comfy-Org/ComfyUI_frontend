import { onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'

import { clamp } from 'es-toolkit'

import { denormalize } from '@/utils/mathUtil'

interface UseTimelineScrubOptions {
  trackRef: Ref<HTMLElement | null>
  frameMax: Ref<number>
  scrubMin: Ref<number>
  scrubMax: Ref<number>
  contentInsetX: number
  isDisabled: () => boolean
  onScrub: (frame: number) => void
}

export function useTimelineScrub(
  playheadFrame: Ref<number>,
  options: UseTimelineScrubOptions
) {
  const {
    trackRef,
    frameMax,
    scrubMin,
    scrubMax,
    contentInsetX,
    isDisabled,
    onScrub
  } = options

  const isScrubDragging = ref(false)
  let cleanupScrubDrag: (() => void) | null = null

  function pointerToFrame(event: PointerEvent) {
    const el = trackRef.value
    if (!el) return playheadFrame.value
    const rect = el.getBoundingClientRect()
    const contentWidth = Math.max(rect.width - 2 * contentInsetX, 1)
    const normalized = clamp(
      (event.clientX - rect.left - contentInsetX) / contentWidth,
      0,
      1
    )
    return Math.round(denormalize(normalized, 0, frameMax.value))
  }

  function scrubToFrame(frame: number, force = false) {
    const clamped = clamp(frame, scrubMin.value, scrubMax.value)
    if (!force && clamped === playheadFrame.value) return
    playheadFrame.value = clamped
    onScrub(clamped)
  }

  function updateScrubFromPointer(event: PointerEvent) {
    scrubToFrame(pointerToFrame(event))
  }

  function startScrubDrag(event: PointerEvent) {
    if (isDisabled() || event.button !== 0) return

    const el = trackRef.value
    if (!el) return

    cleanupScrubDrag?.()

    isScrubDragging.value = true
    scrubToFrame(pointerToFrame(event), true)
    try {
      el.setPointerCapture(event.pointerId)
    } catch {
      // non-active pointer id; scrubbing continues with bubbling events
    }

    const onMove = (moveEvent: PointerEvent) => {
      updateScrubFromPointer(moveEvent)
    }

    const endDrag = () => {
      isScrubDragging.value = false
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('lostpointercapture', endDrag)
      cleanupScrubDrag = null
    }

    cleanupScrubDrag = endDrag

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('lostpointercapture', endDrag)
  }

  onScopeDispose(() => {
    isScrubDragging.value = false
    cleanupScrubDrag?.()
  })

  return { isScrubDragging, startScrubDrag, scrubToFrame }
}
