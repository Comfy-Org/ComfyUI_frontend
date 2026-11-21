import {
  transition,
  TransitionPresets,
  tryOnScopeDispose,
  usePreferredReducedMotion
} from '@vueuse/core'
import { computed, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

const SCRUB_DURATION_MS = 1000
const EASE_DURATION_MS = 300

/** Shows `progress` (0 to 1) as a position between the two keyframes. */
export function useCompositedProgress(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  progress: MaybeRefOrGetter<number>,
  keyframes: Keyframe[]
) {
  const motionPreference = usePreferredReducedMotion()
  const clamped = computed(() => {
    const value = toValue(progress)
    return Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), 1)
  })
  const shown = shallowRef(clamped.value)
  let easeId = 0

  watch([clamped, motionPreference], ([value, motion]) => {
    const id = ++easeId
    if (motion === 'reduce') {
      shown.value = value
      return
    }
    void transition(shown, shown.value, value, {
      duration: EASE_DURATION_MS,
      easing: TransitionPresets.easeOutCubic,
      abort: () => id !== easeId
    })
  })

  let animation: Animation | undefined
  let animatedElement: HTMLElement | undefined

  function release() {
    if (animation) animation.effect = null
    animation = undefined
    animatedElement = undefined
  }

  watch(
    [() => toValue(target), shown],
    ([element, value]) => {
      if (!element) {
        release()
        return
      }
      if (animatedElement !== element) {
        release()
        animation = element.animate(keyframes, {
          duration: SCRUB_DURATION_MS,
          fill: 'both'
        })
        animation.pause()
        animatedElement = element
      }
      if (animation) animation.currentTime = value * SCRUB_DURATION_MS
    },
    { immediate: true, flush: 'post' }
  )

  tryOnScopeDispose(() => {
    easeId++
    release()
  })
}
