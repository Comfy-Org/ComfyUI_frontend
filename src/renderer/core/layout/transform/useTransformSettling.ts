import { useDebounceFn, useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

interface TransformSettlingOptions {
  /**
   * Delay in ms before transform is considered "settled" after last interaction
   * @default 256
   */
  settleDelay?: number
  /**
   * Whether to use passive event listeners (better performance but can't preventDefault)
   * @default true
   */
  passive?: boolean
}

/**
 * Tracks when canvas transforms (zoom or pan) are actively changing vs settled.
 *
 * Applies `will-change: transform` during interactions to prevent costly
 * re-rasterization, then removes it after settling to restore visual quality.
 *
 * Detects both wheel events (zoom) and pointer drag (pan).
 */
export function useTransformSettling(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  options: TransformSettlingOptions = {}
) {
  const { settleDelay = 256, passive = true } = options

  const isTransforming = ref(false)

  const markTransformSettled = useDebounceFn(() => {
    isTransforming.value = false
  }, settleDelay)

  function markInteracting() {
    isTransforming.value = true
    void markTransformSettled()
  }

  const eventOptions = { capture: true, passive }

  useEventListener(target, 'wheel', markInteracting, eventOptions)
  usePointerDrag(target, markInteracting, eventOptions)

  return {
    isTransforming
  }
}

/**
 * Calls `onDrag` on each pointermove while a pointer is held down.
 */
function usePointerDrag(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  onDrag: () => void,
  eventOptions: AddEventListenerOptions
) {
  const isPointerDown = ref(false)

  useEventListener(
    target,
    'pointerdown',
    () => {
      isPointerDown.value = true
    },
    eventOptions
  )

  useEventListener(
    target,
    'pointermove',
    () => {
      if (isPointerDown.value) onDrag()
    },
    eventOptions
  )

  useEventListener(
    target,
    'pointerup',
    () => {
      isPointerDown.value = false
    },
    eventOptions
  )

  useEventListener(
    target,
    'pointercancel',
    () => {
      isPointerDown.value = false
    },
    eventOptions
  )
}
