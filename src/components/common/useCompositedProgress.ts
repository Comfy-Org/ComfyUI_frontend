import {
  transition,
  TransitionPresets,
  usePreferredReducedMotion
} from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { computed, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

const SCRUB_DURATION_MS = 1000
const EASE_DURATION_MS = 300

/** Shows `progress` (0 to 1) as a position between the two keyframes. */
export function useCompositedProgress(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  progress: MaybeRefOrGetter<number>,
  keyframes: MaybeRefOrGetter<Keyframe[]>
) {
  const motionPreference = usePreferredReducedMotion()
  const clamped = computed(() => {
    const value = toValue(progress)
    return Number.isNaN(value) ? 0 : clamp(value, 0, 1)
  })
  const shown = shallowRef(clamped.value)

  watch([clamped, motionPreference], ([value, motion], _, onCleanup) => {
    let aborted = false
    onCleanup(() => {
      aborted = true
    })
    if (motion === 'reduce') {
      shown.value = value
      return
    }
    void transition(shown, shown.value, value, {
      duration: EASE_DURATION_MS,
      easing: TransitionPresets.easeOutCubic,
      abort: () => aborted
    })
  })

  watch(
    [() => toValue(target), () => toValue(keyframes)],
    ([element, frames], _, onCleanup) => {
      if (!element) return
      const animation = element.animate(frames, {
        duration: SCRUB_DURATION_MS,
        fill: 'both'
      })
      animation.pause()
      const stop = watch(
        shown,
        (value) => {
          animation.currentTime = value * SCRUB_DURATION_MS
        },
        { immediate: true, flush: 'post' }
      )
      onCleanup(() => {
        stop()
        animation.effect = null
      })
    },
    { immediate: true, flush: 'post' }
  )
}
