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
 * This composable helps optimize rendering quality during transform interactions.
 * When the user is actively zooming or panning, we can reduce rendering quality
 * for better performance. Once the transform "settles" (stops changing), we can
 * trigger high-quality re-rasterization.
 *
 * The settling concept prevents constant quality switching during interactions
 * by waiting for a period of inactivity before considering the transform complete.
 *
 * Uses VueUse's useEventListener for automatic cleanup and useDebounceFn for
 * efficient settle detection.
 *
 * @example
 * ```ts
 * const { isTransforming } = useTransformSettling(canvasRef, {
 *   settleDelay: 200
 * })
 *
 * // Use in CSS classes or rendering logic
 * const cssClass = computed(() => ({
 *   'low-quality': isTransforming.value,
 *   'high-quality': !isTransforming.value
 * }))
 * ```
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
  /** Number of active pointers (supports multi-touch correctly). */
  const pointerCount = ref(0)

  useEventListener(
    target,
    'pointerdown',
    (e: PointerEvent) => {
      // Only primary (0) and middle (1) buttons trigger canvas pan.
      if (e.button === 0 || e.button === 1) pointerCount.value++
    },
    eventOptions
  )

  useEventListener(
    target,
    'pointermove',
    () => {
      if (pointerCount.value > 0) onDrag()
    },
    eventOptions
  )

  // Listen on window so the release is caught even if the pointer
  // leaves the canvas before the button is released.
  useEventListener(
    window,
    'pointerup',
    () => {
      if (pointerCount.value > 0) pointerCount.value--
    },
    eventOptions
  )

  useEventListener(
    window,
    'pointercancel',
    () => {
      if (pointerCount.value > 0) pointerCount.value--
    },
    eventOptions
  )
}
