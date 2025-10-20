import { useDebounceFn, useEventListener, useThrottleFn } from '@vueuse/core'
import { ref } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

interface TransformSettlingOptions {
  /**
   * Delay in ms before transform is considered "settled" after last interaction
   * @default 200
   */
  settleDelay?: number
  /**
   * Whether to track both zoom (wheel) and pan (pointer drag) interactions
   * @default false
   */
  trackPan?: boolean
  /**
   * Throttle delay for high-frequency pointermove events (only used when trackPan is true)
   * @default 16 (~60fps)
   */
  pointerMoveThrottle?: number
  /**
   * Whether to use passive event listeners (better performance but can't preventDefault)
   * @default true
   */
  passive?: boolean
}

/**
 * Tracks when canvas transforms (zoom/pan) are actively changing vs settled.
 *
 * This composable helps optimize rendering quality during transformations.
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
 *   settleDelay: 200,
 *   trackPan: true
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
  const {
    settleDelay = 200,
    trackPan = false,
    pointerMoveThrottle = 16,
    passive = true
  } = options

  const isTransforming = ref(false)
  let isPanning = false

  /**
   * Mark transform as active
   */
  const markTransformActive = () => {
    isTransforming.value = true
  }

  /**
   * Mark transform as settled (debounced)
   */
  const markTransformSettled = useDebounceFn(() => {
    isTransforming.value = false
  }, settleDelay)

  /**
   * Handle any transform event - mark active then queue settle
   */
  const handleTransformEvent = () => {
    markTransformActive()
    void markTransformSettled()
  }

  // Wheel handler
  const handleWheel = () => {
    handleTransformEvent()
  }

  // Pointer handlers for panning
  const handlePointerDown = () => {
    if (trackPan) {
      isPanning = true
      handleTransformEvent()
    }
  }

  // Throttled pointer move handler for performance
  const handlePointerMove = trackPan
    ? useThrottleFn(() => {
        if (isPanning) {
          handleTransformEvent()
        }
      }, pointerMoveThrottle)
    : undefined

  const handlePointerEnd = () => {
    if (trackPan) {
      isPanning = false
      // Don't immediately stop - let the debounced settle handle it
    }
  }

  // Register event listeners with auto-cleanup
  useEventListener(target, 'wheel', handleWheel, {
    capture: true,
    passive
  })

  if (trackPan) {
    useEventListener(target, 'pointerdown', handlePointerDown, {
      capture: true
    })

    if (handlePointerMove) {
      useEventListener(target, 'pointermove', handlePointerMove, {
        capture: true,
        passive
      })
    }

    useEventListener(target, 'pointerup', handlePointerEnd, {
      capture: true
    })

    useEventListener(target, 'pointercancel', handlePointerEnd, {
      capture: true
    })
  }

  return {
    isTransforming
  }
}
